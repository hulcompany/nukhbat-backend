import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Validate,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UUID } from 'crypto';
import { BasePaginationDto, OXorValidator, XorValidator } from 'core';
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
  @IsOptional()
  purpose?: QuestionPurpose;

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

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsArray()
  @ValidateIf((q) => q.type === QuestionType.OPTIONS)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @ArrayMinSize(2)
  options?: QuestionOptionDto[];

  @IsArray()
  @ValidateIf((q) => q.type === QuestionType.MATCH)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionMatchDto)
  @ArrayMinSize(3)
  matchingItems?: QuestionMatchDto[];
}
