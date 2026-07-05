"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchValidator = void 0;
const class_validator_1 = require("class-validator");
let MatchValidator = class MatchValidator {
    validate(value, args) {
        // if (value !== undefined && value !== null) {
        //   return false;
        // }
        const object = args.object;
        const properties = args.constraints;
        if (properties == undefined || properties?.length == 0) {
            return true;
        }
        for (let i = 0; i < properties.length; i++) {
            if (object[properties[i]] != object[properties[0]]) {
                return false;
            }
        }
        return true;
    }
    defaultMessage(args) {
        // const value = (args.object as any)[args.property];
        // if (value !== undefined && value !== null) {
        //   return `"${args.property}" is not allowed`;
        // }
        return `"${args.constraints}" must match them self`;
    }
};
exports.MatchValidator = MatchValidator;
exports.MatchValidator = MatchValidator = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'match', async: false })
], MatchValidator);
//# sourceMappingURL=match.dto.js.map