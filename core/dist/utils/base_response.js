"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseResponse = void 0;
class BaseResponse {
    constructor(params = {}) {
        const { message, data, ...rest } = params;
        this.message = params.message || 'Success';
        this.data = params.data;
        Object.assign(this, rest);
    }
}
exports.BaseResponse = BaseResponse;
//# sourceMappingURL=base_response.js.map