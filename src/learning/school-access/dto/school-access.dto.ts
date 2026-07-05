import { IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class SchoolAccessDto {
  @IsUUID()
  schoolId: UUID;
  @IsUUID()
  trackId: UUID;
}
