import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { applyPsqlFilter, BasePaginationModel, SortType } from 'core';
import { StudentProfile } from './entity/student-profile.entity';
import { StudentProfileGetDto } from './dto/student.dto';
import { max } from 'lodash';
import { StudentActivity } from './entity/student-activity.entity';

// student-side profile access — owns the repo ops; the school-side
// service composes these with a schoolId scope
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly repo: Repository<StudentProfile>,
    private readonly ds: DataSource,
  ) {}

  // every function takes an optional EntityManager so callers can join
  // an outer transaction() (e.g. redeeming a subscription key)
  private getRepo(em?: EntityManager) {
    return em?.getRepository(StudentProfile) ?? this.repo;
  }

  async find(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    return await this.getRepo(em).find({
      where: filter,
      relations: relations,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    return await this.getRepo(em).findOne({
      where: filter,
      relations: relations,
    });
  }

  async findOneOrFail(
    filter: FindOptionsWhere<StudentProfile>,
    relations?: FindOptionsRelations<StudentProfile>,
    em?: EntityManager,
  ) {
    let profile = await this.findOne(filter, relations, em);
    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }
    return profile;
  }

  async create(params: DeepPartial<StudentProfile>, em?: EntityManager) {
    let repo = this.getRepo(em);
    return await repo.save(params);
  }
  async enroll(
    params: { userId: UUID; schoolId: UUID; trackId: UUID },
    em?: EntityManager,
  ) {
    const existing = await this.findOne(
      { userId: params.userId },
      undefined,
      em,
    );
    if (existing) {
      if (existing.trackId !== params.trackId) {
        throw new BadRequestException("You Can't change student track");
      }
      if (existing.schoolId !== params.schoolId) {
        throw new BadRequestException("You Can't change student school");
      }
      return existing;
    }
    return await this.create(params, em);
  }

  async update(
    filter: FindOptionsWhere<StudentProfile>,
    data: DeepPartial<StudentProfile>,
    em?: EntityManager,
  ) {
    let old = await this.findOneOrFail(filter, undefined, em);
    if (old.schoolId && (data.school || data.schoolId)) {
      throw new BadRequestException("You Can't change student school");
    }
    if (old.trackId && (data.track || data.trackId)) {
      throw new BadRequestException("You Can't change student track");
    }
    let res = await this.getRepo(em).update(filter, data);
    if (!res.affected) {
      throw new NotFoundException('Student profile not found');
    }
    return await this.findOneOrFail(filter, undefined, em);
  }

  async delete(filter: FindOptionsWhere<StudentProfile>, em?: EntityManager) {
    let res = await this.getRepo(em).delete(filter);
    if (!res.affected) {
      throw new NotFoundException('Student profile not found');
    }
  }

  async ledgeBalance(
    id: UUID,
    params: { gems?: number; xp?: number; em?: EntityManager },
  ) {
    let repo = params.em?.getRepository(StudentProfile) || this.repo;
    let profile = await repo.findOneOrFail({ where: { id } });
    let gems = max([0, profile.gems + (params.gems ?? 0)]);
    let xps = max([0, profile.xp + (params.xp ?? 0)]);
    await repo.save({ id, xp: xps, gems: gems });
    return { gems, xps };
  }

  // owner-scoped callers pass schoolId from the context; trackId/userId
  // come off the DTO as plain equality filters
  async getByCriteria(params: { params: StudentProfileGetDto }) {
    const query = params.params;
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.school', 'school')
      .leftJoinAndSelect('s.track', 'track')
      .leftJoinAndSelect('s.user', 'user')
      // applyPsqlFilter skips `sort` — order manually or pagination drifts
      .orderBy('s.createdAt', query.sort || SortType.Desc);
    applyPsqlFilter({
      queryBuilder: qb,
      query: query,
      options: {
        name: {
          value: (v) => {
            return ['user.name ~* :name', { name: v }];
          },
        },
        schoolId: {
          value: (v) => {
            return ['s.schoolId = :schoolId', { schoolId: v }];
          },
        },
        trackId: {
          value: (v) => {
            return ['s.trackId = :trackId', { trackId: v }];
          },
        },
      },
    });

    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: query.skip,
      limit: query.limit,
    });
  }

  async updateDailyStreak(studentId: UUID, em?: EntityManager) {
    const repo = this.getRepo(em);

    const activityRepo = em
      ? em.getRepository(StudentActivity)
      : this.repo.manager.getRepository(StudentActivity);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // سجل النشاط اليومي
    // id يتم توليده تلقائياً
    // unique(studentId, date) يمنع التكرار
    await activityRepo
      .createQueryBuilder()
      .insert()
      .into(StudentActivity)
      .values({
        studentId,
        date: today,
      })
      .orIgnore()
      .execute();

    const profile = await repo.findOneOrFail({
      where: { id: studentId },
    });

    let current = profile.currentStreak ?? 0;
    let longest = profile.longestStreak ?? 0;

    if (!profile.lastStreakDate) {
      current = 1;
    } else {
      const last = new Date(profile.lastStreakDate);
      last.setHours(0, 0, 0, 0);

      const diff = (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);

      if (diff === 0) {
        return {
          currentStreak: current,
          longestStreak: longest,
        };
      }

      if (diff === 1) {
        current++;
      } else {
        current = 1;
      }
    }

    longest = Math.max(longest, current);

    await repo.update(
      { id: studentId },
      {
        currentStreak: current,
        longestStreak: longest,
        lastStreakDate: today,
      },
    );

    return {
      currentStreak: current,
      longestStreak: longest,
    };
  }
}
