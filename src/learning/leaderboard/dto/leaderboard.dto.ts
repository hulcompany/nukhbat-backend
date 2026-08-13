import { IsUUID } from 'class-validator';
import { UUID } from 'crypto';
import { BasePaginationDto } from 'core';

export class SchoolLeaderboardDto extends BasePaginationDto {
  @IsUUID()
  trackId: UUID;
}
