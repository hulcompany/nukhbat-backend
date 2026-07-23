import { ErrorsRecord } from 'core';

export const LearningErrors = 'LearningErrors';

export enum LearningErrorCodes {
  Learning_01 = 'Learning_01',
}

ErrorsRecord.addErrors(LearningErrors, [
  {
    code: LearningErrorCodes.Learning_01,
    description: "School Don't Have Access To This Track",
  },
]);
