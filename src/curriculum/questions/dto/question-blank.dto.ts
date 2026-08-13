import {
  IsArray,
  IsInt,
  IsString,
  ArrayMinSize,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class QuestionFillBlankDto {
  @IsInt()
  @Min(0)
  index: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  answers: string[];
}
