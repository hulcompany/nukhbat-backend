import { PartialType, OmitType } from '@nestjs/mapped-types';
import { UserMainDto } from './user-main.dto';

export class UserUpdateDto extends PartialType(
  OmitType(UserMainDto, ['email']),
) {}
