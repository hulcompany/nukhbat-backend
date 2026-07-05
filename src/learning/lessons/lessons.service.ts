import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lesson } from './entity/lesson.entity';
import { DataSource, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
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

  async find(params: FindOptionsWhere<Lesson>) {
    return await this.repo.find({ where: params, order: { index: 'ASC' } , relations: {questions: true} });
  }

  async findOneOrFail(params: FindOptionsWhere<Lesson>) {
    let res = await this.repo.findOne({ where: params });
    if (!res) {
      throw new NotFoundException();
    }
    return res;
  }

  async update(params: FindOptionsWhere<Lesson>, data: LessonEditDto) {
    if (data.status == LessonStatusType.draft) {
      throw new BadRequestException("Lesson can't set to draft");
    }
    let old = await this.repo.findOne({
      where: params,
      relations: { questions: true },
    });
    if (!old) {
      throw new NotFoundException('Lesson Not Found');
    }
    // active lessons are locked: only a status change (active -> hidden)
    // is allowed, otherwise the lesson must be deactivated first
    if (
      old.status == LessonStatusType.active &&
      (data.title !== undefined || data.description !== undefined)
    ) {
      throw new BadRequestException(
        'Active lesson is locked, only its status can be changed',
      );
    }
    if (data.status == LessonStatusType.active && !old.questions?.length) {
      throw new BadRequestException(
        "You can't set lesson to active until it have questions",
      );
    }
    await this.repo.update(params, data);
    return await this.repo.findOne({ where: params });
  }

  async delete(params: FindOptionsWhere<Lesson>) {
    let lesson = await this.findOneOrFail(params);
    if (lesson.status == LessonStatusType.active) {
      throw new BadRequestException('Cannot delete an active lesson');
    }
    await transaction(this.ds, async (em) => {
      await this.qs.bulkDelete(
        {
          lesson: { id: lesson.id },
          school: { id: lesson.schoolId },
        },
        em,
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
