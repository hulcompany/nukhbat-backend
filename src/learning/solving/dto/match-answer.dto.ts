import { IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class MatchAnswerDto {
  @IsUUID()
  baseId: UUID;

  @IsUUID()
  matchId: UUID;
}
