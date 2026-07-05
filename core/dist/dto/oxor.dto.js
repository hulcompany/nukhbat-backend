"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OXorValidator = void 0;
const class_validator_1 = require("class-validator");
let OXorValidator = class OXorValidator {
    validate(_, args) {
        console.log(_);
        if (_ !== undefined && _ !== null) {
            return false;
        }
        const object = args.object;
        const properties = args.constraints;
        const definedCount = properties.filter((prop) => object[prop] !== undefined && object[prop] !== null).length;
        return definedCount === 1;
    }
    defaultMessage(args) {
        const properties = args.constraints;
        return `Exactly one or none of [${properties.join(', ')}] must be provided`;
    }
};
exports.OXorValidator = OXorValidator;
exports.OXorValidator = OXorValidator = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'oxor', async: false })
], OXorValidator);
//# sourceMappingURL=oxor.dto.js.map