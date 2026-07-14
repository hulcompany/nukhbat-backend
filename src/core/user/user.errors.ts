import { ErrorsRecord } from 'core';

export enum UserErrorCodes {
  User_1 = 'User_1',
  User_2 = 'User_2',
}

ErrorsRecord.addErrors('user', [
  {
    code: UserErrorCodes.User_1,
    description: 'Email already in use.',
  },
  {
    code: UserErrorCodes.User_2,
    description: 'Wrong Email',
  },
]);
