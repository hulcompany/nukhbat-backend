"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegExpStringSearch = void 0;
class RegExpStringSearch {
    static flags(caseSensitive) {
        return caseSensitive ? '' : 'i';
    }
    static eq(value, caseSensitive = false) {
        return new RegExp(`^${this.escape(value)}$`, this.flags(caseSensitive));
    }
    static contains(value, caseSensitive = false) {
        return new RegExp(this.escape(value), this.flags(caseSensitive));
    }
    static startsWith(value, caseSensitive = false) {
        return new RegExp(`^${this.escape(value)}`, this.flags(caseSensitive));
    }
    static endsWith(value, caseSensitive = false) {
        return new RegExp(`${this.escape(value)}$`, this.flags(caseSensitive));
    }
    static in(values, caseSensitive = false) {
        const joined = values.map((v) => this.escape(v)).join('|');
        return new RegExp(`^(${joined})$`, this.flags(caseSensitive));
    }
    static escape(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
exports.RegExpStringSearch = RegExpStringSearch;
//# sourceMappingURL=regexp.js.map