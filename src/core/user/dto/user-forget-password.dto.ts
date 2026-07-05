import { IsEmail } from 'class-validator';

export class UserForgetPasswordDto {
  @IsEmail()
  email: string;
}
