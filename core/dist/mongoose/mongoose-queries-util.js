"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongooseQueries = getMongooseQueries;
function getMongooseQueries(input) {
    if (input.pagination == undefined || input.pagination === undefined) {
        input.pagination = true;
    }
    if (input.options == undefined || input.options === undefined) {
        input.options = {};
    }
    const conditions = {};
    let skip, limit, total, data, sort;
    if (input.pagination) {
        skip = input.query.skip || 0;
        limit = input.query.limit || 100;
        total = input.query.total ? input.query.total == "true" : false;
        data = input.query.data ? input.query.data == "true" : true;
    }
    sort = input.query.sort || { created: "DESC" };
    let keys = Object.keys(input.query);
    keys = keys.filter((e) => !["skip", "limit", "data", "total", "sort"].includes(e));
    keys.forEach((e) => {
        let options = input.options?.[e];
        let desName = options?.newName || e;
        if (Array.isArray(input.query[e])) {
            conditions[desName] = options?.value
                ? options.value(input.query[e])
                : { $in: input.query[e] };
            return;
        }
        if (isObject(input.query[e])) {
            let oKeys = Object.keys(input.query[e]);
            if (!conditions[desName]) {
                conditions[desName] = {};
            }
            oKeys.forEach((e2) => {
                let options = input.options?.[e + "." + e2];
                let nName = options?.newName || "$" + e2;
                conditions[desName][nName] = options?.value
                    ? options.value(input.query[e][e2])
                    : input.query[e][e2];
            });
            return;
        }
        conditions[desName] = options?.value ? options.value(input.query[e]) : input.query[e];
    });
    if (sort == 0) {
        sort = undefined;
    }
    if (sort) {
        if (sort?.created) {
            sort._id = sort.created;
            delete sort.created;
        }
        Object.keys(sort).forEach((e) => {
            sort[e] == "DESC" ? (sort[e] = -1) : (sort[e] = 1);
        });
    }
    return {
        skip: skip,
        limit: limit,
        total: total,
        data: data,
        sort: sort,
        conditions: conditions,
    };
}
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
//# sourceMappingURL=mongoose-queries-util.js.map