import { IsNotEmpty, IsString } from 'class-validator';
import { EmailField } from 'core';

export class AuthLoginDto {
  @EmailField()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}


export class AuthRefreshTokenDto {
  @IsString()
  token: string;
}