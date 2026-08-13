import { IsInt, IsString, Min } from 'class-validator';

export class FillBlankAnswerDto {
  @IsInt()
  @Min(0)
  index: number;

  @IsString()
  answer: string;
}
