import { ErrorsRecord } from 'core';

export const SchoolErrorCodes = 'SchoolErrorCodes';

export enum SchoolAccessErrorCodes {
  SCHOOL_ACCESS_1 = 'SCHOOL_ACCESS_01',
}

ErrorsRecord.addErrors(SchoolErrorCodes, [
  {
    code: SchoolAccessErrorCodes.SCHOOL_ACCESS_1,
    description: "School Don't Have Access To This Track",
  },
]);
