import { IsOptional, IsString, IsEnum, IsEmail } from 'class-validator';
import { BasePaginationDto } from 'core';
import { RoleType } from '../role/enum/role.type';

export class UsersGetDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(RoleType)
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
