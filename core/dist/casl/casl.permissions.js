"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASLPermissionsRegister = void 0;
exports.buildCASL = buildCASL;
const ability_1 = require("@casl/ability");
function buildCASL(subject, action, actor, role = undefined) {
    let access = reg.getAccessConfig(subject);
    if (!access)
        return;
    const roleAccess = access[role ?? '*'];
    // console.log("Role Access " + roleAccess);
    if (!roleAccess)
        return;
    const { can, build } = new ability_1.AbilityBuilder(ability_1.Ability);
    // console.log(subject);
    // console.log(actor);
    // console.log(role);
    // console.log(action);
    let permissions = roleAccess(actor) || [];
    for (const permission of permissions) {
        const actions = (Array.isArray(permission.action) ? permission.action : [permission.action]).map((a) => a.trim().toLowerCase());
        if (!actions.includes(action.toLowerCase()))
            continue;
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
    constructor() {
        this.permissionTable = new Map();
    }
    register(subject, access) {
        this.permissionTable.set(subject, access);
    }
    getAccessConfig(subject) {
        return this.permissionTable.get(subject);
    }
}
let reg = new Reg();
exports.CASLPermissionsRegister = reg;
//# sourceMappingURL=casl.permissions.js.map