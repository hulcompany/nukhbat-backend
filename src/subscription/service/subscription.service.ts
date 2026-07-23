import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  applyPsqlFilter,
  BasePaginationModel,
  ErrorsRecord,
  SortType,
  transaction,
} from 'core';
import { SubscriptionKeyService } from './subscription-key.service';
import { Subscription, SubscriptionType } from '../entity/subscription.entity';
import {
  SubscriptionGetDto,
  SubscriptionStatusFilter,
} from '../dto/subscription.dto';
import { AppConfig } from '../../conf';
import { SchoolService } from '../../school/school.service';
import { SubscriptionErrorCodes } from '../errors';
import { SubscriptionKey } from '../entity/subscription-key.entity';
import { SchoolAccessService } from '../../school-access/school-access.service';
import { StudentService } from '../../student/student.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly repo: Repository<Subscription>,
    private readonly keys: SubscriptionKeyService,
    private readonly profiles: StudentService,
    private readonly schoolAccess: SchoolAccessService,
    private readonly schoolService: SchoolService,
    private readonly ds: DataSource,
  ) {}

  private getRepo(em?: EntityManager) {
    return em?.getRepository(Subscription) ?? this.repo;
  }

  // the caller's current live (non-expired) subscription, if any —
  // SubscriptionGuard's access check
  async findLiveByUser(userId: UUID, em?: EntityManager) {
    return await this.getRepo(em).findOne({
      where: { studentProfile: { userId }, expireDate: MoreThan(new Date()) },
      relations: { studentProfile: true },
      order: { expireDate: 'DESC' },
    });
  }

  // the caller's current live PAID subscription, if any. A live free trial
  // deliberately does not count — it may be upgraded straight to paid.
  async findLivePaidByUser(userId: UUID, em?: EntityManager) {
    return await this.getRepo(em).findOne({
      where: {
        studentProfile: { userId },
        type: SubscriptionType.paid,
        expireDate: MoreThan(new Date()),
      },
      relations: { studentProfile: true },
    });
  }

  // the caller's most recent subscription regardless of expiry — lets the
  // client show "expired, renew" now that expiry no longer sits on the profile
  async findMyCurrentSubscription(userId: UUID, em?: EntityManager) {
    let res = await this.getRepo(em).findOne({
      where: { studentProfile: { userId } },
      relations: { studentProfile: true },
      order: { expireDate: 'DESC' },
    });
    if (!res) {
      throw new BadRequestException(
        ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_1),
      );
    }
    return res;
  }

  // Free trial: a one-shot freeTrial subscription on the default school.
  // enroll() enforces one-profile-per-user, so a trial is only ever a
  // brand-new student's first touch.
  async freeTrial(userId: UUID, trackId: UUID) {
    const defaultSchool = await this.schoolService.findOneOrFail({
      default: true,
    });
    await this.schoolAccess.assertTrackAccess(defaultSchool.id, trackId);

    return await transaction(this.ds, async (em) => {
      // free trial is once ever: block if the student has any subscription.
      // Inside the transaction so two concurrent trial requests can't both
      // pass the check (enroll no longer throws on an existing profile).
      const anyOld = await this.getRepo(em).findOne({
        where: {
          studentProfile: { user: { id: userId } },
        },
      });
      if (anyOld) {
        throw new BadRequestException(
          'You are not allowed for free trial anymore .',
        );
      }

      const profile = await this.profiles.enroll(
        { userId, schoolId: defaultSchool.id, trackId },
        em,
      );

      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + AppConfig.FREE_TRIAL_DAYS);

      const subscription = await this.getRepo(em).save(
        this.getRepo(em).create({
          type: SubscriptionType.freeTrial,
          expireDate,
          studentProfile: { id: profile.id },
        }),
      );

      return await this.getRepo(em).findOne({
        where: { id: subscription.id },
        relations: { studentProfile: true },
      });
    });
  }

  // Redeem a key: enrolls the student (first touch) or adds a paid
  // subscription to their existing profile, then consumes the key — all in
  // one transaction. Owns the redemption policy; the student module owns the
  // profile write.
  async subscribe(params: { key: string; userId: UUID }) {
    return await transaction(this.ds, async (em) => {
      // a live free trial is fine (upgrade path); only a live PAID sub blocks
      const livePaid = await this.findLivePaidByUser(params.userId, em);
      if (livePaid) {
        throw new BadRequestException('Wait until your subscription ends');
      }
      const key = await em
        .getRepository(SubscriptionKey)
        .findOne({ where: { key: params.key } });
      if (!key) {
        throw new BadRequestException(
          ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_2),
        );
      }
      if (key.usedById) {
        throw new BadRequestException(
          ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_2),
        );
      }
      await this.schoolAccess.assertTrackAccess(key.schoolId, key.trackId);
      const expireDate = new Date();
      expireDate.setFullYear(expireDate.getFullYear() + AppConfig.KEY_AGE_YEAR);
      let profile = await this.profiles.enroll(
        {
          userId: params.userId,
          schoolId: key.schoolId,
          trackId: key.trackId,
        },
        em,
      );
      const subscription = await this.getRepo(em).save(
        this.getRepo(em).create({
          type: SubscriptionType.paid,
          expireDate,
          studentProfile: { id: profile.id },
        }),
      );

      await this.keys.markUsed(key.id, subscription.id, em);
      return await this.getRepo(em).findOne({
        where: { id: subscription.id },
        relations: { studentProfile: true },
      });
    });
  }

  // admin-only listing across all subscriptions
  async getByCriteria(params: SubscriptionGetDto) {
    const qb = this.repo
      .createQueryBuilder('sub')
      .leftJoinAndSelect('sub.studentProfile', 'profile')
      .leftJoinAndSelect('profile.user', 'user')
      .orderBy('sub.createdAt', params.sort || SortType.Desc);

    applyPsqlFilter({
      queryBuilder: qb,
      query: params,
      options: {
        userId: {
          value: (v) => ['profile.userId = :userId', { userId: v }],
        },
        type: {
          value: (v) => ['sub.type = :type', { type: v }],
        },
        status: {
          value: (v) => [
            v === SubscriptionStatusFilter.active
              ? 'sub.expireDate > now()'
              : 'sub.expireDate <= now()',
            {},
          ],
        },
      },
    });

    const [data, count] = await qb.getManyAndCount();
    return new BasePaginationModel({
      list: data,
      totalRecords: count,
      skip: params.skip,
      limit: params.limit,
    });
  }
}
