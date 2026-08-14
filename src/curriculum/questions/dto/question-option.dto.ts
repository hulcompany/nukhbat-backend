import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class QuestionOptionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isCorrect: boolean;
}
