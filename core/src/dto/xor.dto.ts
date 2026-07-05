import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'xor', async: false })
export class XorValidator implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    // if (_ !== undefined && _ !== null) {
    //   return false;
    // }
    const object = args.object as any;
    const properties: any[] | undefined = args.constraints;

    if (properties == undefined || properties?.length == 0) {
      return true;
    }

    const definedCount = properties.filter(
      (prop) => object[prop] !== undefined && object[prop] !== null,
    ).length;

    return definedCount === 1;
  }

  defaultMessage(args: ValidationArguments) {
    // const value = (args.object as any)[args.property];
    // if (value !== undefined && value !== null) {
    //   return `"${args.property}" is not allowed`;
    // }
    const properties: string[] = args.constraints;
    return `Exactly one of [${properties.join(', ')}] must be provided`;
  }
}
