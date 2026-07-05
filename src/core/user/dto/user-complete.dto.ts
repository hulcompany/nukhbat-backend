
import { OmitType } from '@nestjs/mapped-types';
import { UserMainDto } from './user-main.dto';

export class UserCompleteDto extends OmitType(UserMainDto, ['email']) {
  // @IsUUID()
  // trackId: UUID;
}
