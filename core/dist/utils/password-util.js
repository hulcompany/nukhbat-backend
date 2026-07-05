"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
async function hashPassword(password, salt) {
    return await bcrypt_1.default.hash(password, salt);
}
async function comparePassword(hash, password) {
    return await bcrypt_1.default.compare(password, hash);
}
//# sourceMappingURL=password-util.js.map