"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenFieldsException = void 0;
const common_1 = require("@nestjs/common");
class ForbiddenFieldsException extends common_1.HttpException {
    constructor(fields) {
        super(fields ? `Forbidden fields: ${fields.join(', ')}` : "Forbidden Fields", 403);
    }
}
exports.ForbiddenFieldsException = ForbiddenFieldsException;
//# sourceMappingURL=errors.js.map