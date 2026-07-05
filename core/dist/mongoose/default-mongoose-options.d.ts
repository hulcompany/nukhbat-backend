import { SchemaOptions } from "mongoose";
interface Params<T> {
    hideToJson?: string[];
    options?: SchemaOptions<T>;
}
export declare function defaultDbOptions<T>(params?: Params<T>): any;
export {};
//# sourceMappingURL=default-mongoose-options.d.ts.map