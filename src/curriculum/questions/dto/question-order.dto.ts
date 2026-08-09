import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class QuestionOrderDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
