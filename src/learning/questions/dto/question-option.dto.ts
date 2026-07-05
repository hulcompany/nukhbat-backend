import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class QuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return false;
    }

    return value === true || value === 'true';
  })
  isCorrect: boolean = false;
}
