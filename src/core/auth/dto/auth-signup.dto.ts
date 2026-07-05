import {
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

export class AuthSignUpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
