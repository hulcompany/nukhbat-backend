import { Ability, AbilityTuple } from '@casl/ability';
type PermissionFn = (actor: any) => AccessAction[];
export type AccessConfig = Record<string, PermissionFn>;
export interface AccessAction {
    action: string | string[];
    fields?: string[] | undefined;
    actorCondition?: (() => boolean) | undefined;
    entityCondition?: (entity: any) => boolean;
    dbQuery?: any;
    forbiddenBodyFields?: string[] | undefined;
    forbiddenQueryFields?: string[] | undefined;
}
export interface CASLPermission {
    casl: Ability<AbilityTuple>;
    fields?: string[] | undefined;
    actorCondition?: (() => boolean) | undefined;
    entityCondition: (entity: any) => boolean;
    dbQuery?: any;
    forbiddenBodyFields?: string[] | undefined;
    forbiddenQueryFields?: string[] | undefined;
}
export declare function buildCASL(subject: string, action: string, actor: any, role?: string | undefined): CASLPermission | undefined;
declare class Reg {
    permissionTable: Map<string, AccessConfig>;
    register(subject: string, access: AccessConfig): void;
    getAccessConfig(subject: string): AccessConfig | undefined;
}
declare let reg: Reg;
export { reg as CASLPermissionsRegister };
//# sourceMappingURL=casl.permissions.d.ts.map