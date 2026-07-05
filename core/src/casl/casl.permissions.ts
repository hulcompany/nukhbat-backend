import { Ability, AbilityBuilder, AbilityTuple } from '@casl/ability';

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

export function buildCASL(
  subject: string,
  action: string,
  actor: any,
  role: string | undefined = undefined,
): CASLPermission | undefined {
  let access = reg.getAccessConfig(subject);

  if (!access) return;

  const roleAccess = access[role ?? '*'];

  // console.log("Role Access " + roleAccess);
  

  

  if (!roleAccess) return;

  const { can, build } = new AbilityBuilder<Ability<AbilityTuple>>(Ability);
  // console.log(subject);
  // console.log(actor);
  // console.log(role);
  // console.log(action);

  let permissions = roleAccess(actor) || [];

  for (const permission of permissions) {
    const actions = (
      Array.isArray(permission.action) ? permission.action : [permission.action]
    ).map((a) => a.trim().toLowerCase());
    
    if (!actions.includes(action.toLowerCase())) continue;


    actions.forEach((act) => {
      can(act, subject);
    });

    return {
      casl: build(),
      fields: permission.fields,
      actorCondition: permission.actorCondition,
      entityCondition: permission.entityCondition || (() => true),
      dbQuery: permission.dbQuery,
      forbiddenBodyFields: permission.forbiddenBodyFields,
      forbiddenQueryFields: permission.forbiddenQueryFields,
    };
  }
}

class Reg {
  permissionTable: Map<string, AccessConfig> = new Map();
  register(subject: string, access: AccessConfig) {
    this.permissionTable.set(subject, access);
  }
  getAccessConfig(subject: string) {
    return this.permissionTable.get(subject);
  }
}

let reg = new Reg();

export { reg as CASLPermissionsRegister };
