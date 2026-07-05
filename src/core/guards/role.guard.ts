import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  mixin,
  Type,
} from '@nestjs/common';
import { RoleType } from '../role/enum/role.type';

export function RoleGuard(roles: RoleType[]): Type<CanActivate> {
  class RoleGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const user = request.user;
      if (!roles.includes(user?.role)) {
        throw new ForbiddenException('Role Not Allowed');
      }
      return true;
    }
  }

  return mixin(RoleGuardMixin);
}
