import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserMainDto } from './user-main.dto';

export class UserUpdateDto extends PartialType(
  OmitType(UserMainDto, ['email']),
) {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber?: string;
}
