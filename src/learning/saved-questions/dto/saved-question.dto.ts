import { IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class SaveQuestionDto {
  @IsUUID()
  questionId: UUID;
}
