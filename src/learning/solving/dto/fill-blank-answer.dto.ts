import { Transform } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class FillBlankAnswerDto {
  @IsInt()
  @Min(0)
  index: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  answer: string;
}
