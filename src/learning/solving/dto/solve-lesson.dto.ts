import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { UUID } from 'crypto';

// POST /start — begin an attempt on a lesson
export class StartLessonDto {
  @IsUUID()
  lessonId: UUID;
}

// one submitted match pair
export class MatchAnswerDto {
  @IsUUID()
  baseId: UUID;

  @IsUUID()
  matchId: UUID;
}

// the answer for a single question — exactly one shape is filled per the
// question's type (choice / true-false / match). Mirrors what
// QuestionService.checkAnswers consumes.
export class AnswerDto {
  @IsOptional()
  @IsUUID()
  choiceId?: UUID;

  @IsOptional()
  @IsBoolean()
  boolAnswer?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchAnswerDto)
  matches?: MatchAnswerDto[];
}

export class SolveAnswerDto {
  @IsUUID()
  id: UUID;

  @ValidateNested()
  @Type(() => AnswerDto)
  answer: AnswerDto;
}

// POST /solve — submit answers for a started attempt
export class SolveLessonDto {
  // the snapshot id handed back by /start
  @IsUUID()
  snapshotId: UUID;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolveAnswerDto)
  answers: SolveAnswerDto[];
}

// POST /daily-challenge/solve — grade today's challenge for the student's
// track. No snapshot: the challenge's questions live in the DB, and a student
// gets exactly one attempt.
export class SolveDailyChallengeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolveAnswerDto)
  answers: SolveAnswerDto[];
}
