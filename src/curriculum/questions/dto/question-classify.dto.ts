import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { QuestionClassifyType } from '../entity/enum/question-classify.type';
import { Transform } from 'class-transformer';

export class QuestionClassifyDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionClassifyType)
  type: QuestionClassifyType;

  @ValidateIf((o) => o.type === QuestionClassifyType.item)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @Min(0)
  correctCategoryIndex?: number;
}
