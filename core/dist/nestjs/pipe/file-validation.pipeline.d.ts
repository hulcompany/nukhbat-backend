import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
export declare class FileValidationPipeline implements PipeTransform {
    readonly opts?: {
        size?: number;
        types?: string[];
        required?: boolean;
    } | undefined;
    constructor(opts?: {
        size?: number;
        types?: string[];
        required?: boolean;
    } | undefined);
    transform(value: any, metadata: ArgumentMetadata): any;
}
//# sourceMappingURL=file-validation.pipeline.d.ts.map