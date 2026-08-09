import {
  IsArray,
  IsInt,
  IsString,
  ArrayMinSize,
  Min,
} from 'class-validator';


export class QuestionFillBlankDto {

  @IsInt()
  @Min(0)
  index: number;


  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  answers: string[];

}