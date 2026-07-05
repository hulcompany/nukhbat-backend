import { CanActivate, Type } from '@nestjs/common';
import { ActorResolver } from './actor.resolver';
export declare const CASLGuard: (subject: string, action: string, resolveActor?: ActorResolver) => Type<CanActivate>;
export declare function getCaslPermissions(subject: string, action: string, actor: any, request: any): import("./casl.permissions").CASLPermission;
//# sourceMappingURL=casl.guard.d.ts.map