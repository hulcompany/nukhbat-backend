export interface MongooseQuery {
    skip?: number | undefined;
    limit?: number | undefined;
    total?: boolean | undefined;
    data?: boolean | undefined;
    sort?: any;
    conditions?: any;
}
interface MongooseQueryOptions {
    value?: (data: any) => any;
    newName?: string;
}
export declare function getMongooseQueries(input: {
    query: any;
    pagination?: boolean;
    options?: Record<string, MongooseQueryOptions>;
}): MongooseQuery;
export {};
//# sourceMappingURL=mongoose-queries-util.d.ts.map