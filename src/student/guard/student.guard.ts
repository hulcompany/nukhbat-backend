import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ErrorsRecord } from 'core';
import { StudentProfileService } from '../service/student-profile.service';
import { StudentErrorCodes } from '../errors';

@Injectable()
export class StudentGuard implements CanActivate {
  constructor(private readonly service: StudentProfileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId = request.user.id;
    if (!userId) {
      throw new ForbiddenException(
        ErrorsRecord.getError(StudentErrorCodes.StudentError_1),
      );
    }
    const student = await this.service.findOne({
      user: { id: userId },
    });

    if (!student) {
      throw new ForbiddenException(
        ErrorsRecord.getError(StudentErrorCodes.StudentError_1),
      );
    }

    request.context.student = student;

    return true;
  }
}
