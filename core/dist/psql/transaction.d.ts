import { DataSource, EntityManager } from 'typeorm';
export declare function transaction(ds: DataSource, handler: (em: EntityManager) => Promise<any>, opts?: {
    onError?: (e: any) => any;
    onDone?: () => any;
}): Promise<any>;
//# sourceMappingURL=transaction.d.ts.map