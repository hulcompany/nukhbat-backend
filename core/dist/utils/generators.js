"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNumericString = generateNumericString;
function generateNumericString(length) {
    return Array.from({ length: length }, () => Math.floor(Math.random() * 10)).join("");
}
//# sourceMappingURL=generators.js.map