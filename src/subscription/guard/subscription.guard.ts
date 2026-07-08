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

// Cares only about the subscription: the caller must have a live (non-expired)
// subscription. Loads it onto request.context.subscription. Compose with
// StudentGuard({ requireActive: true }) on content routes to also enforce the
// school's activation kill-switch.
export function SubscriptionGuard(): Type<CanActivate> {
  @Injectable()
  class SubscriptionGuardMixin implements CanActivate {
    constructor(private readonly service: SubscriptionService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();

      const userId = request.user?.id;
      const subscription = userId
        ? await this.service.findLiveByUser(userId)
        : null;

      if (!subscription) {
        throw new ForbiddenException(
          ErrorsRecord.getError(SubscriptionErrorCodes.Subscription_1),
        );
      }

      request.context.subscription = subscription;
      return true;
    }
  }

  return mixin(SubscriptionGuardMixin);
}
