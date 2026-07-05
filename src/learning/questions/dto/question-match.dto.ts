import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { QuestionMatchType } from '../entity/enum/question-match.type';
import { Transform } from 'class-transformer';

export class QuestionMatchDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionMatchType)
  type: QuestionMatchType;

  // only required on base rows; match rows don't reference anything
  @ValidateIf((o) => o.type === QuestionMatchType.base)
  @Transform(({ value }) => {
    return value ? Number(value?.toString()) : undefined;
  })
  @IsInt()
  @Min(0)
  correctIndex: number;
}
