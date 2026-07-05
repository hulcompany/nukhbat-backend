import { RequestHandler } from 'express';
interface ErrorInfo {
    code: string;
    description: string;
}
declare class ErrorRecord {
    private table;
    constructor();
    getErrorsMap(): Map<string, ErrorInfo[]>;
    addErrors(feature: string, errors: ErrorInfo[]): void;
    getErrorsAsList(): ErrorInfo[];
    getError(code: string): {
        message: string;
        code: string;
    };
}
declare const errorRecord: ErrorRecord;
export declare function createErrorRequestHandler(): RequestHandler;
export { errorRecord as ErrorsRecord };
export type { ErrorInfo };
//# sourceMappingURL=exceptions.d.ts.map