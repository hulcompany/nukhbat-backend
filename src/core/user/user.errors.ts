import { ErrorsRecord } from 'core';

export enum UserErrorCodes {
  User_1 = 'User_1',
}

ErrorsRecord.addErrors('user', [
  {
    code: UserErrorCodes.User_1,
    description: 'Email already in use.',
  },
]);
