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
import { QuestionMatchDto } from './question-match.dto';
import { QuestionClassifyDto } from './question-classify.dto';
import { QuestionOrderDto } from './question-order.dto';
import { QuestionFillBlankDto } from './question-blank.dto';
import { QuestionOptionGroupDto } from './question-option-group.dto';

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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionGroupDto)
  optionGroups?: QuestionOptionGroupDto[];

  @ValidateIf((o) => o.type === QuestionType.MATCH)
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => QuestionMatchDto)
  matchingItems?: QuestionMatchDto[];

  @ValidateIf((o) => o.type === QuestionType.classify)
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionClassifyDto)
  classify?: QuestionClassifyDto[];

  @ValidateIf((o) => o.type === QuestionType.order)
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOrderDto)
  orders?: QuestionOrderDto[];

  @ValidateIf((o) => o.type === QuestionType.fillBlanks)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionFillBlankDto)
  fillBlanks?: QuestionFillBlankDto[];

  // trueFalse questions carry their answer key here; the component service
  // stores it in the dedicated one-to-one row.
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

  // explanation revealed with the verdict; optional, stored as null when absent
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  verdictText?: string;
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

  // send null to clear the explanation; omit it to leave it untouched
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  verdictText?: string | null;
}

export class AdminQuestionGetDto extends QuestionGetDto {
  @IsUUID()
  @IsOptional()
  schoolId?: UUID;

  @IsUUID()
  @IsOptional()
  trackId?: UUID;
}
