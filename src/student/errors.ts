import { ErrorsRecord } from 'core';

export enum StudentErrorCodes {
  StudentError_1 = 'Student_1',
  StudentError_2 = 'Student_2',
}

ErrorsRecord.addErrors('student', [
  {
    code: StudentErrorCodes.StudentError_1,
    description: "You don't have student profile",
  },
  {
    code: StudentErrorCodes.StudentError_2,
    description: 'Your account is unActivated please contact your school',
  },
]);
