import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import { randomBytes } from 'crypto';
import { UUID } from 'crypto';
import { SubscriptionKey } from '../entity/subscription-key.entity';
import {
  SubscriptionKeyCreateDto,
  SubscriptionKeyCreateManyDto,
} from '../dto/subscription.dto';
import { applyPsqlFilter, BasePaginationModel, transaction } from 'core';
import { SubscriptionKeyGetDto } from '../dto/subscription.dto';
import { LearningService } from '../../learning/learning.service';

// no 0/O/1/I — keys get typed by hand
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KEY_GROUPS = 6;
const KEY_GROUP_LEN = 4;

@Injectable()
export class SubscriptionKeyService {
  constructor(
    @InjectRepository(SubscriptionKey)
    private readonly repo: Repository<SubscriptionKey>,
    private readonly ds: DataSource,
    private readonly learningService: LearningService,
  ) {}

  // every function takes an optional EntityManager so callers can join
  // an outer transaction()
  private getRepo(em?: EntityManager) {
    return em?.getRepository(SubscriptionKey) ?? this.repo;
  }

  async find(filter: FindOptionsWhere<SubscriptionKey>, em?: EntityManager) {
    return await this.getRepo(em).find({
      where: filter,
      order: { createdAt: 'DESC' },
    });
  }

  async getByCriteria(params: SubscriptionKeyGetDto) {
    const qb = this.repo
      .createQueryBuilder('sk')
      .leftJoinAndSelect('sk.school', 'school')
      .leftJoinAndSelect('sk.track', 'track')
      // who redeemed the key: key → subscription → profile → user
      .leftJoinAndSelect('sk.usedBy', 'usedBy')
      .leftJoinAndSelect('usedBy.studentProfile', 'profile')
      .leftJoinAndSelect('profile.user', 'user');
    qb.orderBy('sk.createdAt', params.sort);

    applyPsqlFilter({
      queryBuilder: qb,
      query: params,
    });

    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: params.skip,
      limit: params.limit,
    });
  }

  async findOneOrFail(
    filter: FindOptionsWhere<SubscriptionKey>,
    em?: EntityManager,
  ) {
    let key = await this.getRepo(em).findOne({ where: filter });
    if (!key) {
      throw new NotFoundException('Subscription key not found');
    }
    return key;
  }

  async create(params: SubscriptionKeyCreateDto, em?: EntityManager) {
    let [key] = await this.createMany({ ...params, count: 1 }, em);
    return key;
  }

  // `count` keys for the same school+track in one call
  async createMany(params: SubscriptionKeyCreateManyDto, em?: EntityManager) {
    await this.learningService.assertSchoolTrackAccess(
      params.schoolId,
      params.trackId,
    );
    // optional in the shared DTO — callers must have resolved it by now
    let repo = this.getRepo(em);
    let keys: SubscriptionKey[] = [];
    for (let i = 0; i < params.count; i++) {
      keys.push(
        repo.create({
          key: this.generateKey(),
          track: { id: params.trackId },
          school: { id: params.schoolId },
        }),
      );
    }
    repo.save(keys);
    return keys;
  }

  // single-use, atomically: only claims the key if it is still available
  // (usedById IS NULL). A concurrent redeem of the same key updates 0 rows
  // and this throws, rolling the surrounding transaction back.
  async markUsed(keyId: UUID, subscriptionId: UUID, em?: EntityManager) {
    const res = await this.getRepo(em).update(
      { id: keyId, usedById: IsNull() },
      { usedById: subscriptionId },
    );
    if (res.affected !== 1) {
      throw new BadRequestException('Subscription key already used');
    }
  }

  async delete(filter: FindOptionsWhere<SubscriptionKey>, em?: EntityManager) {
    let res = await this.getRepo(em).delete(filter);
    if (!res.affected) {
      throw new NotFoundException('Subscription key not found');
    }
  }

  // all-or-nothing: every id must exist (within the filter scope) or
  // nothing is deleted — the transaction makes that atomic
  async deleteMany(
    ids: UUID[],
    filter?: FindOptionsWhere<SubscriptionKey>,
    em?: EntityManager,
  ) {
    ids = [...new Set(ids)];
    await transaction(em?.connection || this.ds, async (em) => {
      let res = await em.getRepository(SubscriptionKey).delete({
        ...filter,
        id: In(ids),
      });
      if (res.affected !== ids.length) {
        throw new NotFoundException('Subscription key not found');
      }
    });
  }

  // XXXX-XXXX-XXXX from a 31-char alphabet (~59 bits) — collisions are
  // negligible, and the unique column rejects one anyway
  private generateKey() {
    let groups: string[] = [];
    for (let g = 0; g < KEY_GROUPS; g++) {
      let bytes = randomBytes(KEY_GROUP_LEN);
      let group = '';
      for (let i = 0; i < KEY_GROUP_LEN; i++) {
        group += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
      }
      groups.push(group);
    }
    return groups.join('-');
  }
}
