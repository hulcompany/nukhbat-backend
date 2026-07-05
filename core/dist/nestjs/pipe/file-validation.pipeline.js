"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileValidationPipeline = void 0;
const common_1 = require("@nestjs/common");
const errors_1 = require("../errors");
let FileValidationPipeline = class FileValidationPipeline {
    constructor(opts) {
        this.opts = opts;
    }
    transform(value, metadata) {
        if (!value && this.opts?.required) {
            throw new common_1.BadRequestException('File is required to complete the request');
        }
        if (!value) {
            return;
        }
        if (this.opts?.size && value.size > this.opts?.size) {
            throw new errors_1.FileSizeNotAllowed(value.size, this.opts.size);
        }
        if (this.opts?.types && !this.opts.types.includes(value.mimetype)) {
            throw new errors_1.FileTypeNotAllowed(value.mimetype, this.opts.types);
        }
        return value;
    }
};
exports.FileValidationPipeline = FileValidationPipeline;
exports.FileValidationPipeline = FileValidationPipeline = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], FileValidationPipeline);
//# sourceMappingURL=file-validation.pipeline.js.map