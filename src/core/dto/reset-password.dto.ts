import { IsString, MaxLength, MinLength, Validate } from 'class-validator';
import { EmailField, MatchValidator } from 'core';

export class ResetPasswordDto {
  @EmailField()
  email: string;

  @IsString()
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  newPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Validate(MatchValidator, ['newPassword', 'confirmPassword'])
  confirmPassword: string;
}
