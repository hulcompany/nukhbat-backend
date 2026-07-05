"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPsqlFilter = applyPsqlFilter;
const common_1 = require("@nestjs/common");
function applyPsqlFilter(input) {
    const apply = (cond, params) => {
        input.queryBuilder.andWhere(cond, params);
    };
    if (input.query) {
        Object.keys(input.query).forEach((e) => {
            let fieldOptions = input.options?.[e] ?? {};
            let fieldName = fieldOptions?.newName || e;
            if (fieldOptions.skip || e == 'skip' || e == 'limit' || e == 'sort') {
                return;
            }
            const value = input.query[e];
            if (value === null || value === undefined)
                return;
            if (fieldOptions.value) {
                let [cond, params] = fieldOptions.value(value);
                apply(cond, params);
                return;
            }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                Object.keys(value).forEach((key) => {
                    let nestedOpts = input.options?.[e + '.' + key] ?? {};
                    if (nestedOpts.skip) {
                        return;
                    }
                    let alias = input.queryBuilder.alias;
                    let field = `${alias}.${fieldName}`;
                    let filterValue = value[key];
                    if (value[key] === undefined || value[key] === null)
                        return;
                    switch (key) {
                        case 'gte':
                            apply(`${field} >= :${e + '_' + key}`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'lte':
                            apply(`${field} <= :${e + '_' + key}`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'gt':
                            apply(`${field} > :${e + '_' + key}`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'lt':
                            apply(`${field} < :${e + '_' + key}`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'eq':
                            apply(`${field} = :${e + '_' + key}`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'in':
                            apply(`${field} IN (:...${e + '_' + key})`, {
                                [e + '_' + key]: filterValue,
                            });
                            break;
                        case 'mod':
                            if (Array.isArray(filterValue) && filterValue.length === 2) {
                                const [divisor, remainder] = filterValue;
                                apply(`${field} % :${e}_divisor = :${e}_remainder`, {
                                    [`${e}_divisor`]: divisor,
                                    [`${e}_remainder`]: remainder,
                                });
                            }
                            else {
                                throw new common_1.BadRequestException('PSQL mod operator should be array e.g [DesiredKey]: [number , expected mod]');
                            }
                            break;
                        case 'contains':
                            apply(`${field} ~* :${e}_${key}`, {
                                [`${e}_${key}`]: filterValue,
                            });
                            break;
                        case 'startsWith':
                            apply(`${field} ~* :${e}_${key}`, {
                                [`${e}_${key}`]: `^${filterValue}`,
                            });
                            break;
                        case 'endsWith':
                            apply(`${field} ~* :${e}_${key}`, {
                                [`${e}_${key}`]: `${filterValue}$`,
                            });
                            break;
                    }
                });
                return;
            }
            if (fieldOptions.regExp) {
                let reg = fieldOptions.regExp;
                const operator = reg.caseSensitive ? '~' : '~*';
                let cond;
                let param = {};
                let name = input.queryBuilder.alias + '.' + fieldName;
                switch (reg.regexp) {
                    case 'contains':
                        cond = `${name} ${operator} :${e}`;
                        param = { [e]: `${value}` };
                        break;
                    case 'startsWith':
                        cond = `${name} ${operator} :${e}`;
                        param = { [e]: `^${value}` };
                        break;
                    case 'endsWith':
                        cond = `${name} ${operator} :${e}`;
                        param = { [e]: `${value}$` };
                        break;
                }
                apply(cond, param);
                return;
            }
            apply(`${input.queryBuilder.alias}.${fieldName} = :${e}`, {
                [e]: value,
            });
        });
    }
    if (input.pagination || input.pagination === undefined) {
        input.queryBuilder
            .skip(Number(input.query?.skip || 0))
            .take(Number(input.query?.limit || 10));
    }
    return input.queryBuilder;
}
//# sourceMappingURL=apply.psql.filter.js.map