"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWithTransaction = executeWithTransaction;
const mongoose_1 = __importDefault(require("mongoose"));
async function executeWithTransaction(fn) {
    let session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        let res = await fn(session);
        await session.commitTransaction();
        await session.endSession();
        return res;
    }
    catch (e) {
        await session.abortTransaction();
        await session.endSession();
        throw e;
    }
}
//# sourceMappingURL=utils.js.map