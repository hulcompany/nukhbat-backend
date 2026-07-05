"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTypeNotAllowed = exports.FileSizeNotAllowed = void 0;
const common_1 = require("@nestjs/common");
const errors_1 = require("../errors");
class FileSizeNotAllowed extends common_1.HttpException {
    constructor(size, foundedSize) {
        super({
            message: size && foundedSize
                ? `File Size Too Big ${size} must be less than or equal ${foundedSize}`
                : 'File Size Too Big',
            code: errors_1.ErrorCommonCodes.fileSizeNotAllowed,
        }, 400);
    }
}
exports.FileSizeNotAllowed = FileSizeNotAllowed;
class FileTypeNotAllowed extends common_1.HttpException {
    constructor(type, types) {
        super({
            message: types
                ? `File Not Allowed ${type} must be one of ${types}`
                : 'File Not Allowed',
            code: errors_1.ErrorCommonCodes.fileTypeNotAppowed,
        }, 400);
    }
}
exports.FileTypeNotAllowed = FileTypeNotAllowed;
//# sourceMappingURL=errors.js.map