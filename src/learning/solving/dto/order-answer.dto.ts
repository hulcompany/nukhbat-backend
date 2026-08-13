import { IsInt, IsUUID, Min } from 'class-validator';
import { UUID } from 'crypto';

export class OrderAnswerDto {
  @IsUUID()
  id: UUID;

  @IsInt()
  @Min(0)
  order: number;
}
