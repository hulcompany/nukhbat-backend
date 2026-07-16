import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lesson } from './entity/lesson.entity';
import {
  DataSource,
  DeepPartial,
  FindOptionsRelations,
  FindOptionsWhere,
  ILike,
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
    private readonly ds: DataSource,
    private readonly qs: QuestionService,
  ) {}

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
  ) {
    if (params.title) {
      params.title = ILike(`%${params.title}%`);
    }
    return await this.repo.find({
      where: params,
      order: { index: 'ASC' },
      relations: relations
        ? { ...relations, questions: true }
        : { questions: true },
    });
  }

  async findOneOrFail(params: FindOptionsWhere<Lesson>) {
    let res = await this.repo.findOne({ where: params });
    if (!res) {
      throw new NotFoundException();
    }
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
