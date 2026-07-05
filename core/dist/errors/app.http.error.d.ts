import { HttpException, HttpStatus } from '@nestjs/common';
interface AppErrorOptions {
    code: string;
    message?: string;
    statusCode?: HttpStatus;
    args?: Record<string, any>;
}
export declare class AppHttpError extends HttpException {
    statusCode: number;
    code: string;
    args?: any;
    constructor(opts: AppErrorOptions);
}
export {};
//# sourceMappingURL=app.http.error.d.ts.map