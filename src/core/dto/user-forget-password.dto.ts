import { EmailField } from 'core';

export class UserForgetPasswordDto {
  @EmailField()
  email: string;
}
