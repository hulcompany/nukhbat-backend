"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordMissmatchException = void 0;
const common_1 = require("@nestjs/common");
class PasswordMissmatchException extends common_1.HttpException {
    constructor() {
        super('Password Missmatch', 400);
    }
}
exports.PasswordMissmatchException = PasswordMissmatchException;
//# sourceMappingURL=errors.js.map