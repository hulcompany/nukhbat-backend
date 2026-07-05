import { HttpException } from '@nestjs/common';

export class PasswordMissmatchException extends HttpException {
  constructor() {
    super('Password Missmatch', 400);
  }
}