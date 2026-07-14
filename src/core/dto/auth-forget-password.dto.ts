import { EmailField } from 'core';

export class AuthForgetPasswordDto {
  @EmailField()
  email: string;
}
