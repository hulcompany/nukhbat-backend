import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lesson } from './entity/lesson.entity';
import { LessonUsed } from './entity/lesson-used.entity';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsSelect,
  FindOptionsWhere,
  ILike,
  In,
  Repository,
} from 'typeorm';
import { LessonEditDto } from './dto/lessons.dto';
import { LessonStatusType } from './entity/lesson.status.type';
import { transaction } from 'core';
import { QuestionService } from '../questions/questions.service';
import { UUID } from 'crypto';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson) private readonly repo: Repository<Lesson>,
    @InjectRepository(LessonUsed)
    private readonly usedRepo: Repository<LessonUsed>,
    private readonly ds: DataSource,
    private readonly qs: QuestionService,
  ) {}

  // Marks a lesson as used so its content freezes. Idempotent. Not exposed to
  // schools — the student attempt flow calls it (via the CurriculumService
  // facade) the moment a student has any attempt on the lesson.
  async markAsUsed(lessonId: UUID, em?: EntityManager) {
    const repo = em ? em.getRepository(LessonUsed) : this.usedRepo;
    await repo.upsert({ lessonId, used: true }, ['lessonId']);
  }

  async isUsedLesson(lessonId: UUID, em?: EntityManager) {
    const repo = em ? em.getRepository(LessonUsed) : this.usedRepo;
    return await repo.exists({ where: { lessonId: lessonId } });
  }

  // Stamps each lesson's transient `used` flag from the LessonUsed table in a
  // single query. Lessons with no LessonUsed row (or used=false) get `false`.
  private async attachUsed(lessons: Lesson[], em?: EntityManager) {
    const ids = lessons.map((l) => l.id).filter((id): id is UUID => !!id);
    if (!ids.length) return;
    const repo = em ? em.getRepository(LessonUsed) : this.usedRepo;
    const rows = await repo.find({
      where: { lessonId: In(ids), used: true },
      select: { lessonId: true },
    });
    const usedSet = new Set(rows.map((r) => r.lessonId));
    for (const lesson of lessons) {
      lesson.used = usedSet.has(lesson.id);
    }
  }

  async create(params: DeepPartial<Lesson>) {
    // max+1, not count+1, so gaps left by deletions can't duplicate an index
    let last = await this.repo.find({
      where: { schoolId: params.schoolId, unitId: params.unitId },
      order: { index: 'DESC' },
      take: 1,
    });
    params.index = (last[0]?.index ?? 0) + 1;
    return await this.repo.save(params);
  }

  async find(
    params: FindOptionsWhere<Lesson>,
    relations?: FindOptionsRelations<Lesson>,
    select?: FindOptionsSelect<Lesson>,
    order?: FindOptionsOrder<Lesson>,
  ) {
    if (params.title) {
      params.title = ILike(`%${params.title}%`);
    }
    const lessons = await this.repo.find({
      where: params,
      order: { index: 'ASC', ...order },
      relations: relations
        ? { ...relations, questions: true }
        : { questions: true },
      select: select,
    });
    await this.attachUsed(lessons);
    return lessons;
  }

  async findOneOrFail(params: FindOptionsWhere<Lesson>) {
    let res = await this.repo.findOne({ where: params });
    if (!res) {
      throw new NotFoundException();
    }
    await this.attachUsed([res]);
    return res;
  }

  async update(params: FindOptionsWhere<Lesson>, data: LessonEditDto) {
    let old = await this.repo.findOne({
      where: params,
      relations: { questions: true },
    });
    if (!old) {
      throw new NotFoundException('Lesson Not Found');
    }
    // a published lesson always has at least one question; QuestionService
    // keeps that true afterwards by refusing to delete the last one
    if (data.status == LessonStatusType.published && !old.questions?.length) {
      throw new BadRequestException(
        "You can't publish a lesson until it has questions",
      );
    }
    // a used lesson is frozen — it can't be reverted to draft
    if (data.status == LessonStatusType.draft) {
      const used = await this.usedRepo.findOne({
        where: { lessonId: old.id, used: true },
      });
      if (used) {
        throw new BadRequestException(
          'This lesson is in use and can no longer be set to draft',
        );
      }
    }
    await this.repo.update(params, data);
    return await this.repo.findOne({ where: params });
  }

  async delete(params: FindOptionsWhere<Lesson>) {
    let lesson = await this.findOneOrFail(params);
    await transaction(this.ds, async (em) => {
      // the lesson itself is going away, so the keep-one-question rule
      // doesn't apply to its teardown
      await this.qs.deleteQuestions(
        {
          lesson: { id: lesson.id },
          school: { id: lesson.schoolId },
        },
        { em, skipGuards: true },
      );
      let res = await em
        .getRepository(Lesson)
        .delete({ id: lesson.id, schoolId: lesson.schoolId });
      if (!res.affected) {
        throw new NotFoundException();
      }
    });
  }

  async changeOrder(schoolId: UUID, unitId: UUID, ids: UUID[]) {
    let all = await this.find({ schoolId: schoolId, unitId: unitId });
    await transaction(this.ds, async (em) => {
      let finalIds = [...ids];
      for (let lesson of all) {
        if (!finalIds.includes(lesson.id)) {
          finalIds.push(lesson.id);
        }
      }
      let repo = em.getRepository(Lesson);
      for (let i = 0; i < finalIds.length; i++) {
        let res = await repo.update(
          { id: finalIds[i], schoolId: schoolId, unitId: unitId },
          { index: i + 1 },
        );
        if (!res.affected) {
          throw new NotFoundException('Lesson not found ' + finalIds[i]);
        }
      }
    });
  }
}
