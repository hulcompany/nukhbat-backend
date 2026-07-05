import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Type,
} from '@nestjs/common';
import { buildCASL } from './casl.permissions';
import { ActorResolver, defaultActorResolver } from './actor.resolver';

export const CASLGuard = (
  subject: string,
  action: string,
  resolveActor: ActorResolver = defaultActorResolver,
): Type<CanActivate> => {
  @Injectable()
  class PermissionGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const actor = resolveActor(request);

      request.permissions = getCaslPermissions(subject, action, actor, request);
      return true;
    }
  }

  return PermissionGuardMixin;
};

export function getCaslPermissions(
  subject: string,
  action: string,
  actor: any,
  request: any,
) {
  const permission = buildCASL(subject, action, actor, actor?.role);

  if (!permission || !permission.casl.can(action.toLowerCase(), subject)) {
    throw new ForbiddenException(`Forbidden: cannot ${action} ${subject}`);
  }
  if (permission.forbiddenBodyFields) {
    for (const field of permission.forbiddenBodyFields) {
      if (request.body && request.body[field] != undefined) {
        throw new ForbiddenException('Field ( ' + field + ' ) Not Allowed');
      }
    }
  }

  if (permission.forbiddenQueryFields) {
    for (const field of permission.forbiddenQueryFields) {
      if (request.query && request.query[field] != undefined) {
        throw new ForbiddenException('Field ' + field + ' Not Allowed');
      }
    }
  }

  if (
    permission.actorCondition != undefined &&
    !permission.actorCondition()
  ) {
    throw new ForbiddenException("Actor doesn't have permission");
  }
  return permission;
}
