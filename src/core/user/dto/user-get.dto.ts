import { IsOptional, IsString, IsEnum, IsEmail } from 'class-validator';
import { BasePaginationDto } from 'core';
import { RoleType } from '../../role/enum/role.type';

export class UserGetDto extends BasePaginationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(RoleType)
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  email?: string;
}
