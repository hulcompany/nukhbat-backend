import { OmitType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { UserMainDto } from './user-main.dto';

export class UserCompleteDto extends OmitType(UserMainDto, ['email']) {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phoneNumber: string;
}
