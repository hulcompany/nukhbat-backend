import {
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmailField } from 'core';

export class AuthSignUpDto {
  @EmailField()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsPhoneNumber('SY')
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @MinLength(8)
  password: string;
}
