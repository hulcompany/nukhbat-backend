export declare function applyPsqlFilter(input: {
    query: any;
    queryBuilder: any;
    options?: Record<string, TypeOrmDatabaseQueryOptions>;
    pagination?: boolean;
}): any;
export interface TypeOrmDatabaseQueryOptions {
    value?: (data: any) => [string, any];
    newName?: string;
    skip?: boolean;
    regExp?: PSQLRegExp;
}
export interface PSQLRegExp {
    regexp: 'contains' | 'startsWith' | 'endsWith';
    caseSensitive?: boolean;
}
//# sourceMappingURL=apply.psql.filter.d.ts.map