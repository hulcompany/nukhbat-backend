"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppHttpError = void 0;
const common_1 = require("@nestjs/common");
class AppHttpError extends common_1.HttpException {
    constructor(opts) {
        super({
            message: opts.message,
            code: opts.code,
            args: opts.args,
        }, opts.statusCode ?? 500);
        this.statusCode = opts.statusCode ?? 500;
        this.code = opts.code;
        this.args = opts.args;
    }
}
exports.AppHttpError = AppHttpError;
//# sourceMappingURL=app.http.error.js.map