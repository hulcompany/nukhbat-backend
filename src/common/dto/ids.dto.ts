import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class IdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids: UUID[];
}
