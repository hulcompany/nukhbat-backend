import { ErrorsRecord } from 'core';

export enum SubscriptionErrorCodes {
  Subscription_1 = 'Subscription_1',
}

ErrorsRecord.addErrors('subscription', [
  {
    code: SubscriptionErrorCodes.Subscription_1,
    description: 'You have no active subscription',
  },
]);
