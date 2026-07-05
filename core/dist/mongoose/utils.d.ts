import mongoose, { ClientSession } from 'mongoose';
export declare function executeWithTransaction(fn: (session: ClientSession) => Promise<any>): Promise<any>;
export type MongoId = mongoose.ObjectId | string;
//# sourceMappingURL=utils.d.ts.map