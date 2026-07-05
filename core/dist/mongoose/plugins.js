"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findPlugins = void 0;
const findPlugins = function (schema, options) {
    schema.statics.findAndCount = async function findAndCount(params, projection) {
        let queries = [];
        if (params.total) {
            queries.push(this.countDocuments(params.conditions));
        }
        else {
            queries.push(undefined);
        }
        if (params.data) {
            queries.push(this.find(params.conditions ?? {}, projection)
                .sort(params.sort)
                .skip(params.skip)
                .limit(params.limit));
        }
        else {
            queries.push(undefined);
        }
        let [total, data] = await Promise.all(queries);
        return { total, data };
    };
    schema.statics.aggregateAndCount = async function aggregateAndCount(input) {
        let { skip, limit, conditions, data, sort, total } = input.params;
        // Build projection object
        const fields = typeof input.projection === 'string'
            ? input.projection.split(' ')
            : input.projection;
        let project;
        for (const key in fields || []) {
            const raw = fields[key]?.startsWith('-')
                ? fields[key].slice(1)
                : fields[key];
            if (!project)
                project = {};
            project[raw] = fields[key]?.startsWith('-') ? 0 : 1;
        }
        // Build main stages (sort, skip, limit, pipeline, project)
        const mainStages = [];
        if (sort)
            mainStages.push({ $sort: sort });
        if (skip)
            mainStages.push({ $skip: Number(skip) });
        if (limit)
            mainStages.push({ $limit: Number(limit) });
        if (input.pipeline?.length)
            mainStages.push(...input.pipeline);
        if (project)
            mainStages.push({ $project: project });
        const facet = {};
        if (total)
            facet.total = [
                ...(conditions ? [{ $match: conditions }] : []),
                { $count: 'count' },
            ];
        if (data)
            facet.data = mainStages;
        const pipeline = [];
        if (conditions)
            pipeline.push({ $match: conditions });
        pipeline.push({ $facet: facet });
        const [result] = await this.aggregate(pipeline);
        if (result?.total) {
            result.total = result.total[0]?.count || 0;
        }
        return result;
    };
};
exports.findPlugins = findPlugins;
//# sourceMappingURL=plugins.js.map