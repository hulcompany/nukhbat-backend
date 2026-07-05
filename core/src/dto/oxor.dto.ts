import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'oxor', async: false })
export class OXorValidator implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {

    if (_ !== undefined && _ !== null) {
      return false;
    }
    const object = args.object as any;
    const properties: string[] = args.constraints;

    const definedCount = properties.filter(
      (prop) => object[prop] !== undefined && object[prop] !== null,
    ).length;

    return definedCount === 1;
  }

  defaultMessage(args: ValidationArguments) {
    const properties: string[] = args.constraints;
    return `Exactly one or none of [${properties.join(', ')}] must be provided`;
  }
}
