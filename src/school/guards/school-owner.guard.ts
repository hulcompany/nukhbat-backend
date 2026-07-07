import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SchoolService } from '../school.service';
import { ErrorsRecord } from 'core';
import { SchoolErrorCodes } from '../school-errors';
import { RoleType } from '../../core/role/enum/role.type';

@Injectable()
export class SchoolOwnerGuard implements CanActivate {
  constructor(private readonly schoolService: SchoolService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // admins pass unscoped: ctxt.school stays empty (schoolOrNull = null)
    // so shared routes fall back to their query filters
    if (request.user?.role == RoleType.admin) {
      return true;
    }

    const userId = request.user.id;
    if (!userId) {
      throw new ForbiddenException(
        ErrorsRecord.getError(SchoolErrorCodes.SchoolError_1),
      );
    }

    const school = await this.schoolService.findOne({
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
