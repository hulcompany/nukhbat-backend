import { IsInt, IsUUID, Min } from 'class-validator';
import { UUID } from 'crypto';

export class OptionAnswerDto {
  @IsUUID()
  answered: UUID;

  @IsInt()
  @Min(0)
  index: number;
}
