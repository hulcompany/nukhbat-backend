import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
export declare class BaseResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): import("rxjs").Observable<{
        message: string;
        data: any;
    }>;
}
//# sourceMappingURL=base.response.interceptor.d.ts.map