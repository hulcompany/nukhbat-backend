import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { UUID } from 'crypto';
import { SolveAnswerDto } from './question-answer.dto';

export class SolvingStartLessonDto {
  @IsUUID()
  lessonId: UUID;
}

export class SolvingStartSavedDto {
  @IsUUID()
  courseId: UUID;
}

export class SolvingSnapshotDto {
  @IsUUID()
  snapshotId: UUID;

  @IsArray()
  @ArrayUnique((answer: SolveAnswerDto) => answer.id)
  @ValidateNested({ each: true })
  @Type(() => SolveAnswerDto)
  answers: SolveAnswerDto[];
}
