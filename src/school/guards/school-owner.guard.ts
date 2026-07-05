import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SchoolService } from '../school.service';
import { ErrorsRecord } from 'core';
import { SchoolErrorCodes } from '../school-errors';

@Injectable()
export class SchoolOwnerGuard implements CanActivate {
  constructor(private readonly schoolService: SchoolService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const userId = request.user.id;
    if (!userId) {
      throw new ForbiddenException(
        ErrorsRecord.getError(SchoolErrorCodes.SchoolError_1),
      );
    }
    const schoolId = request.params.schoolId;

    const school = await this.schoolService.findOne({
      id: schoolId,
      owner: {
        id: userId,
      },
    });

    if (!school) {
      throw new ForbiddenException(
        ErrorsRecord.getError(SchoolErrorCodes.SchoolError_1),
      );
    }

    request.context.school = school;

    return true;
  }
}
