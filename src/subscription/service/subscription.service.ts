import { BadRequestException, Injectable } from '@nestjs/common';
import { UUID } from 'crypto';
import { DataSource } from 'typeorm';
import { transaction } from 'core';
import { SubscriptionKeyService } from './subscription-key.service';
import { StudentProfileService } from '../../student/service/student-profile.service';
import { StudentProfile } from '../../student/entity/student-profile.entity';
import { AppConfig } from '../../conf';
import { LearningService } from '../../learning/learning.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly keys: SubscriptionKeyService,
    private readonly profiles: StudentProfileService,
    private readonly learningService: LearningService,
    private readonly ds: DataSource,
  ) {}

  // redeem a key: the profile is created/renewed and the key consumed
  // (single use) in one transaction — a concurrent redeem of the same
  // key hits 0 affected rows on the delete and rolls back
  async subscribe(params: { key: string; userId: UUID }) {
    return await transaction(this.ds, async (em) => {
      let key = await this.keys.findOneOrFail({ key: params.key }, em);
      await this.learningService.assertSchoolTrackAccess(
        key.schoolId,
        key.trackId,
      );

      let expireAt = new Date();
      expireAt.setFullYear(expireAt.getFullYear() + AppConfig.KEY_AGE_YEAR);

      // one profile per student, pinned to one school + track forever:
      // a still-running subscription blocks the redeem, an expired one
      // gets renewed in place — same school and track only
      let existing = await this.profiles.findOne(
        { userId: params.userId },
        undefined,
        em,
      );

      let profile: StudentProfile;
      if (existing) {
        if (!existing.isExpired) {
          throw new BadRequestException('Wait until your subscription ends');
        }
        if (existing.schoolId != key.schoolId) {
          throw new BadRequestException(
            'Subscription key belongs to a different school',
          );
        }
        if (existing.trackId != key.trackId) {
          throw new BadRequestException(
            'Subscription key is for a different track',
          );
        }
        profile = await this.profiles.update(
          { id: existing.id },
          { expireDate: expireAt },
          em,
        );
      } else {
        profile = await this.profiles.create(
          {
            userId: params.userId,
            schoolId: key.schoolId,
            trackId: key.trackId,
            expireDate: expireAt,
          },
          em,
        );
      }

      await this.keys.delete({ id: key.id }, em);
      return profile;
    });
  }
}
