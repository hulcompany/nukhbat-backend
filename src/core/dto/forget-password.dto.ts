import { EmailField } from 'core';

export class ForgetPasswordDto {
  @EmailField()
  email: string;
}
