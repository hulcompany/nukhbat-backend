import { ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
export declare class WithValidator implements ValidatorConstraintInterface {
    validate(_: any, args: ValidationArguments): boolean;
    defaultMessage(args: ValidationArguments): string;
}
//# sourceMappingURL=with.dto.d.ts.map