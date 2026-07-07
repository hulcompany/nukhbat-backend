import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import {
  DeepPartial,
  EntityManager,
  FindOptionsRelations,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { StudentProfile } from '../entity/student-profile.entity';
import { applyPsqlFilter, BasePaginationModel, SortType } from 'core';
import { StudentProfileGetDto } from '../dto/student.dto';

// student-side profile access — owns the repo ops; the school-side
// service composes these with a schoolId scope
@Injectable()
export class StudentProfileService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly repo: Repository<StudentProfile>,
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

  async update(
    filter: FindOptionsWhere<StudentProfile>,
    data: DeepPartial<StudentProfile>,
    em?: EntityManager,
  ) {
    let old = await this.findOneOrFail(filter);
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

  // profile is usable: exists and not expired (null expireDate = no expiry)
  isActive(profile: StudentProfile) {
    return !profile.expireDate || profile.expireDate > new Date();
  }

  // owner-scoped callers pass schoolId from the context; trackId/userId
  // come off the DTO as plain equality filters
  async getByCriteria(params: {
    params: StudentProfileGetDto;
  }) {
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
}
