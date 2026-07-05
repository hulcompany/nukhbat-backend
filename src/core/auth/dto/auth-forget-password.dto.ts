import { IsEmail, IsNotEmpty } from 'class-validator';

export class AuthForgetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
