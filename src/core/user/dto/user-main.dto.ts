import {
  IsEmail,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UserMainDto {
  @IsString()
  name: string;
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password: string;
  @IsPhoneNumber('SY')
  @MaxLength(13)
  @MinLength(13)
  phoneNumber: string;
}
