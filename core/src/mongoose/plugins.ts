import mongoose, { PipelineStage } from 'mongoose';
import { MongooseQuery } from './mongoose-queries-util';
export const findPlugins = function (schema: mongoose.Schema, options: any) {
  schema.statics.findAndCount = async function findAndCount(
    params: MongooseQuery,
    projection?: string[] | string,
  ) {
    let queries :any[] = [];
    if (params.total) {
      queries.push(this.countDocuments(params.conditions));
    } else {
      queries.push(undefined);
    }
    if (params.data) {
      queries.push(
        this.find(params.conditions ?? {}, projection)
          .sort(params.sort)
          .skip(params.skip)
          .limit(params.limit),
      );
    } else {
      queries.push(undefined);
    }
    let [total, data] = await Promise.all(queries);

    return { total, data };
  };

  schema.statics.aggregateAndCount = async function aggregateAndCount(input: {
    params: MongooseQuery;
    projection?: string[] | string;
    pipeline?: mongoose.PipelineStage[];
  }) {
    let { skip, limit, conditions, data, sort, total } = input.params;

    // Build projection object
    const fields =
      typeof input.projection === 'string'
        ? input.projection.split(' ')
        : input.projection;
    let project: any;
    for (const key in fields || []) {
      const raw = fields![key]?.startsWith('-')
        ? fields![key]!.slice(1)
        : fields![key]!;
      if (!project) project = {};
      project[raw] = fields![key]?.startsWith('-') ? 0 : 1;
    }

    // Build main stages (sort, skip, limit, pipeline, project)
    const mainStages: PipelineStage[] = [];

    if (sort) mainStages.push({ $sort: sort });
    if (skip) mainStages.push({ $skip: Number(skip) });
    if (limit) mainStages.push({ $limit: Number(limit) });
    if (input.pipeline?.length) mainStages.push(...input.pipeline);
    if (project) mainStages.push({ $project: project });

    const facet: any = {};
    if (total)
      facet.total = [
        ...(conditions ? [{ $match: conditions }] : []),
        { $count: 'count' },
      ];
    if (data) facet.data = mainStages;

    const pipeline: PipelineStage[] = [];
    if (conditions) pipeline.push({ $match: conditions });
    pipeline.push({ $facet: facet });

    const [result] = await this.aggregate(pipeline);

    if (result?.total) {
      result.total = result.total[0]?.count || 0;
    }

    return result;
  };
};
