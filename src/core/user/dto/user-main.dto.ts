import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class UserMainDto {
  @IsString()
  name: string;
  @IsEmail()
  email: string;
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password: string;
}
