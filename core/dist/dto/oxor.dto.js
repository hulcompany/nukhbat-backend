"use strict";
// import {
//   ValidatorConstraint,
//   ValidatorConstraintInterface,
//   ValidationArguments,
// } from 'class-validator';
Object.defineProperty(exports, "__esModule", { value: true });
// @ValidatorConstraint({ name: 'oxor', async: false })
// export class OXorValidator implements ValidatorConstraintInterface {
//   validate(_: any, args: ValidationArguments) {
//     if (_ !== undefined && _ !== null) {
//       return false;
//     }
//     const object = args.object as any;
//     const properties: string[] = args.constraints;
//     const definedCount = properties.filter(
//       (prop) => object[prop] !== undefined && object[prop] !== null,
//     ).length;
//     return definedCount === 1;
//   }
//   defaultMessage(args: ValidationArguments) {
//     const value = (args.object as any)[args.property];
//     if (value !== undefined && value !== null) {
//       return `"${args.property}" is not allowed`;
//     }
//     const properties: string[] = args.constraints;
//     return `Exactly one or none of [${properties.join(', ')}] must be provided`;
//   }
// }
//# sourceMappingURL=oxor.dto.js.map