import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UUID } from 'crypto';
import { BasePaginationDto } from 'core';
import { QuestionType } from '../entity/enum/question.type';
import { QuestionPurpose } from '../entity/enum/question-purpose.type';
import { QuestionOptionDto } from './question-option.dto';
import { QuestionMatchDto } from './question-match.dto';

export class QuestionCreateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(QuestionType)
  type: QuestionType;

  @IsEnum(QuestionPurpose)
  purpose: QuestionPurpose;

  // required for lesson questions; ignored for dailyChallenge ones
  @ValidateIf((o) => o.purpose !== QuestionPurpose.dailyChallenge)
  @IsUUID()
  lessonId?: UUID;

  // required for dailyChallenge questions; ignored for lesson ones
  @ValidateIf((o) => o.purpose === QuestionPurpose.dailyChallenge)
  @IsUUID()
  courseId?: UUID;

  @ValidateIf((o) => o.type === QuestionType.OPTIONS)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @ArrayMinSize(2)
  options?: QuestionOptionDto[];

  @ValidateIf((o) => o.type === QuestionType.MATCH)
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => QuestionMatchDto)
  matchingItems?: QuestionMatchDto[];

  // trueFalse questions carry their whole answer key here — the service
  // materializes the two option rows from it
  @ValidateIf((o) => o.type === QuestionType.TRUE_FALSE)
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  correctAnswer?: boolean;

  // orderless hints; optional on create, defaults to []
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tips?: string[];
}

export class QuestionBulkCreateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionCreateDto)
  questions: QuestionCreateDto[];
}

export class QuestionGetDto extends BasePaginationDto {
  @IsUUID()
  @IsOptional()
  courseId?: UUID;

  @IsUUID()
  @IsOptional()
  lessonId?: UUID;

  // case-insensitive contains over the question title
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;
}

export class QuestionEditDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tips?: string[];
}

export class AdminQuestionGetDto extends QuestionGetDto {
  @IsUUID()
  @IsOptional()
  schoolId?: UUID;

  @IsUUID()
  @IsOptional()
  trackId?: UUID;
}
