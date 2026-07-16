import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Unit } from './entity/unit.entity';
import {
  DataSource,
  DeepPartial,
  FindOptionsRelations,
  FindOptionsWhere,
  ILike,
  In,
  Repository,
} from 'typeorm';
import { UnitCreateDto, UnitUpdateDto } from './dto/unit-dto';
import { UUID } from 'crypto';
import { transaction } from 'core';
import { Lesson } from '../lessons/entity/lesson.entity';
import { QuestionService } from '../questions/questions.service';
import { ReqContext } from '../../context';

@Injectable()
export class UnitService {
  constructor(
    @InjectRepository(Unit) private readonly repo: Repository<Unit>,
    private readonly ds: DataSource,
    private readonly questionService: QuestionService,
  ) {}

  async create(params: UnitCreateDto, ctxt?: ReqContext) {
    // max+1, not count+1, so gaps left by deletions can't duplicate an index
    let last = await this.repo.find({
      where: { school: { id: ctxt?.school?.id }, courseId: params.courseId },
      order: { index: 'DESC' },
      take: 1,
    });
    let index = (last[0]?.index ?? 0) + 1;
    return await this.repo.save({
      course: { id: params.courseId },
      title: params.title,
      index: index,
      school: { id: ctxt?.school?.id },
    });
  }

  async find(
    params: FindOptionsWhere<Unit>,
    relations?: FindOptionsRelations<Unit>,
  ) {
    let filters = params;
    if (filters.title) {
      filters.title = ILike(`%${params.title}%`);
    }
    return await this.repo.find({
      where: filters,
      order: { index: 'ASC' },
      relations: relations,
    });
  }

  async existsOrFail(params: FindOptionsWhere<Unit>) {
    if (!(await this.repo.exists({ where: params }))) {
      throw new NotFoundException();
    }
  }

  async findOneOrFail(params: FindOptionsWhere<Unit>) {
    let res = await this.repo.findOne({ where: params });
    if (!res) {
      throw new NotFoundException();
    }
    return res;
  }

  async delete(params: FindOptionsWhere<Unit>) {
    return await transaction(this.ds, async (em) => {
      let unitRepo = em.getRepository(Unit);
      let lessonRepo = em.getRepository(Lesson);

      let unit = await unitRepo.findOne({ where: params });
      if (!unit) {
        throw new NotFoundException();
      }

      // tear down the tree bottom-up: questions → lessons → unit
      let lessons = await lessonRepo.find({
        where: { unitId: unit.id, schoolId: unit.schoolId },
      });
      if (lessons.length) {
        // the lessons themselves are going away, so the keep-one-question
        // rule doesn't apply to their teardown
        await this.questionService.deleteQuestions(
          {
            lesson: { id: In(lessons.map((e) => e.id)) },
          },
          { em, skipGuards: true },
        );
        await lessonRepo.delete({ unitId: unit.id, schoolId: unit.schoolId });
      }

      let res = await unitRepo.delete({ id: unit.id });
      if (!res.affected) {
        throw new NotFoundException();
      }
      // return res;
    });
  }

  async update(params: FindOptionsWhere<Unit>, data: UnitUpdateDto) {
    let res = await this.repo.update(params, data);
    if (!res.affected) {
      throw new NotFoundException();
    }
    return await this.find(params);
  }

  async changeOrder(filters: FindOptionsWhere<Unit>, ids: UUID[]) {
    let all = await this.find(filters);
    await transaction(this.ds, async (em) => {
      let finalIds = [...ids];
      for (let unit of all) {
        if (!finalIds.includes(unit.id)) {
          finalIds.push(unit.id);
        }
      }
      let repo = em.getRepository(Unit);
      for (let i = 0; i < finalIds.length; i++) {
        // scoped by school+course so a foreign id can't touch other rows
        let res = await repo.update(
          { id: finalIds[i], ...filters },
          { index: i + 1 },
        );
        if (!res.affected) {
          throw new NotFoundException('Unit not found ' + finalIds[i]);
        }
      }
    });
  }
}
