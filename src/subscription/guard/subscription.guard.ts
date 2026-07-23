import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { ErrorsRecord } from 'core';
import { SubscriptionService } from '../service/subscription.service';
import { SubscriptionErrorCodes } from '../errors';
import { StudentService } from '../../student/student.service';

// Cares only about the subscription: the caller must have a live (non-expired)
// subscription. Loads it onto request.context.subscription. Compose with
// StudentGuard({ requireActive: true }) on content routes to also enforce the
// school's activation kill-switch.
export function SubscriptionGuard(opts?: {
  needsSubscription?: boolean;
  needsActive?: boolean;
}): Type<CanActivate> {
  @Injectable()
  class SubscriptionGuardMixin implements CanActivate {
    constructor(
      private readonly service: SubscriptionService,
      private readonly studentService: StudentService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      let needsActive = opts?.needsActive || true;
      let needSubscription = opts?.needsSubscription || true;
      const request = context.switchToHttp().getRequest();

      const userId = request.user?.id;
      const subscription = userId
        ? await this.service.findLiveByUser(userId)
        : null;

      if (!subscription && needSubscription) {
        throw new ForbiddenException(
          ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_1),
        );
      }
      let student = subscription?.studentProfile;
      if (!student) {
        student =
          (await this.studentService.findOne({ user: { id: userId } })) ||
          undefined;
        if (!student) {
          throw new ForbiddenException(
            ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_1),
          );
        }
        if (student && !student.active && needsActive) {
          throw new ForbiddenException(
            ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_3),
          );
        }
      }

      request.context.subscription = subscription;
      request.context.student = student;
      return true;
    }
  }

  return mixin(SubscriptionGuardMixin);
}
