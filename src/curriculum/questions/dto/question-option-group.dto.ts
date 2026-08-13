import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuestionOptionDto } from './question-option.dto';
import { Type } from 'class-transformer';

export class QuestionOptionGroupDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsInt()
  @Min(0)
  index: number;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];
}
