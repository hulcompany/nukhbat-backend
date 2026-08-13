import { ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class ClassifyAnswerDto {
  @IsUUID()
  categoryId: UUID;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  items: UUID[];
}
