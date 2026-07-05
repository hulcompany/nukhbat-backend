import { ErrorsRecord } from 'core';

export enum SchoolErrorCodes {
  SchoolError_1 = 'School_1',
}

ErrorsRecord.addErrors('school', [
  {
    code: SchoolErrorCodes.SchoolError_1,
    description: 'You need school to continue',
  },
]);
