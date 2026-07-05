import { HttpException } from '@nestjs/common';
export declare class FileSizeNotAllowed extends HttpException {
    constructor(size?: number, foundedSize?: number);
}
export declare class FileTypeNotAllowed extends HttpException {
    constructor(type?: string, types?: string[]);
}
//# sourceMappingURL=errors.d.ts.map