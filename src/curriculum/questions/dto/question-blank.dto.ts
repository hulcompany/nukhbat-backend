import {
  IsArray,
  IsInt,
  IsString,
  ArrayMinSize,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QuestionFillBlankDto {
  @IsInt()
  @Min(0)
  index: number;

  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((answer) =>
          typeof answer === 'string' ? answer.trim() : answer,
        )
      : value,
  )
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  answers: string[];
}
