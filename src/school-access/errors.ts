import { ErrorsRecord } from 'core';

export const LearningErrors = 'LearningErrors';

export enum SchoolAccessErrorCodes {
  SCHOOL_ACCESS_1 = 'SCHOOL_ACCESS_01',
}

ErrorsRecord.addErrors(LearningErrors, [
  {
    code: SchoolAccessErrorCodes.SCHOOL_ACCESS_1,
    description: "School Don't Have Access To This Track",
  },
]);
