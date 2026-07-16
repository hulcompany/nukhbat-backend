import { IsNotEmpty, IsString } from 'class-validator';
import { EmailField } from 'core';

export class LoginDto {
  @EmailField()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  token: string;
}
