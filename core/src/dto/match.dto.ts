import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'match', async: false })
export class MatchValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // if (value !== undefined && value !== null) {
    //   return false;
    // }
    const object = args.object as any;
    const properties: any[] | undefined = args.constraints;
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

  defaultMessage(args: ValidationArguments) {
    // const value = (args.object as any)[args.property];
    // if (value !== undefined && value !== null) {
    //   return `"${args.property}" is not allowed`;
    // }
    return `"${args.constraints}" must match them self`;
  }
}
