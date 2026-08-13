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
import { Transform, Type } from 'class-transformer';

export class QuestionOptionGroupDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  // multipart delivers every field as a string; JSON already sends a number
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  index: number;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options: QuestionOptionDto[];
}
