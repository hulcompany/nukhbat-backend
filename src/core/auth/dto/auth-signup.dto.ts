import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AuthSignUpDto {
  @IsEmail()
  @IsNotEmpty()
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
