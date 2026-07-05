"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePaginationModel = void 0;
class BasePaginationModel {
    constructor(params) {
        this.list = params.list;
        if (params.skip != undefined && params.limit != undefined) {
            this.next = params.skip + params.limit < params.totalRecords;
        }
        if (params.skip != undefined) {
            this.back = params.skip > 0;
        }
        this.totalRecords = params.totalRecords;
    }
}
exports.BasePaginationModel = BasePaginationModel;
//# sourceMappingURL=base-pagination.model.js.map