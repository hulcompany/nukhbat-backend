import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { ErrorsRecord } from 'core';
import { StudentErrorCodes } from '../errors';
import { StudentService } from '../student.service';

// Loads the caller's StudentProfile onto request.context.student. Cares only
// about identity — subscription/expiry is SubscriptionGuard's job.
//  - no options        → just requires a profile to exist (Student_1)
//  - { requireActive } → school must not have deactivated them (Student_2)
// Mirrors the RoleGuard(...) factory idiom so options are set per-route.
export function StudentGuard(options?: {
  requireActive?: boolean;
}): Type<CanActivate> {
  @Injectable()
  class StudentGuardMixin implements CanActivate {
    constructor(private readonly service: StudentService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const request = context.switchToHttp().getRequest();

      if (
        request.context.subscription?.studentProfile &&
        request.context.subscription?.studentProfile?.active &&
        options?.requireActive
      ) {
        throw new ForbiddenException(
          ErrorsRecord.getError(StudentErrorCodes.StudentError_2),
        );
      }

      const userId = request.user?.id;
      if (!userId) {
        throw new ForbiddenException(
          ErrorsRecord.getError(StudentErrorCodes.StudentError_1),
        );
      }

      const student = await this.service.findOne({ user: { id: userId } });
      if (!student) {
        throw new ForbiddenException(
          ErrorsRecord.getError(StudentErrorCodes.StudentError_1),
        );
      }

      if (options?.requireActive && !student.active) {
        throw new ForbiddenException(
          ErrorsRecord.getError(StudentErrorCodes.StudentError_2),
        );
      }

      request.context.student = student;
      return true;
    }
  }

  return mixin(StudentGuardMixin);
}
