import {  PipelineStage } from 'mongoose';
import { MongooseQuery } from '../mongoose';

declare global {
  namespace Mongoose {
    interface Model<
      T = {},
      TQueryHelpers = {},
      TMethods = {},
      TVirtuals = {},
      TSchema = any,
    > {
      findAndCount(
        params: MongooseQuery,
        projection?: string[] | string,
      ): Promise<{ total?: number; data?: T[] }>;

      aggregateAndCount(input: {
        params: MongooseQuery;
        projection?: string[] | string;
        pipeline?: PipelineStage[];
      }): Promise<{ total?: number; data?: T[] }>;
    }
  }
}
