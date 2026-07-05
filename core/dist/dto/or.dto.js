"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrValidator = void 0;
const class_validator_1 = require("class-validator");
let OrValidator = class OrValidator {
    validate(_, args) {
        // if (_ !== undefined && _ !== null) {
        //   return false;
        // }
        const object = args.object;
        const properties = args.constraints;
        if (properties == undefined || properties?.length == 0) {
            return true;
        }
        const definedCount = properties.filter((prop) => object[prop] !== undefined && object[prop] !== null).length;
        return (definedCount === 1 || definedCount === 0 || definedCount == undefined);
    }
    defaultMessage(args) {
        // const value = (args.object as any)[args.property];
        // if (value !== undefined && value !== null) {
        //   return `"${args.property}" is not allowed`;
        // }
        const properties = args.constraints;
        return `Exactly one of [${properties.join(', ')}] must be provided or no one`;
    }
};
exports.OrValidator = OrValidator;
exports.OrValidator = OrValidator = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'or', async: false })
], OrValidator);
//# sourceMappingURL=or.dto.js.map