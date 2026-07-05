"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorsRecord = void 0;
exports.createErrorRequestHandler = createErrorRequestHandler;
const error_common_code_1 = require("./error.common.code");
class ErrorRecord {
    constructor() {
        this.table = new Map();
    }
    getErrorsMap() {
        return this.table;
    }
    addErrors(feature, errors) {
        this.table.set(feature, errors);
    }
    getErrorsAsList() {
        return Array.from(this.table.values()).flat();
    }
    getError(code) {
        for (const errors of this.table.values()) {
            const error = errors.find((e) => e.code === code);
            if (error) {
                return {
                    message: error.description,
                    code: error.code,
                };
            }
        }
        return {
            message: 'An unknown error occurred.',
            code: error_common_code_1.ErrorCommonCodes.unknownError,
        };
    }
}
const errorRecord = new ErrorRecord();
exports.ErrorsRecord = errorRecord;
function createErrorRequestHandler() {
    return (_req, res) => {
        res.json(Object.fromEntries(errorRecord.getErrorsMap()));
    };
}
//# sourceMappingURL=exceptions.js.map