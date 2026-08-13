import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { UUID } from 'crypto';
import { ClassifyAnswerDto } from './classify-answer.dto';
import { FillBlankAnswerDto } from './fill-blank-answer.dto';
import { MatchAnswerDto } from './match-answer.dto';
import { OptionAnswerDto } from './option-answer.dto';
import { OrderAnswerDto } from './order-answer.dto';

export class QuestionAnswerDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionAnswerDto)
  options?: OptionAnswerDto[];

  @IsOptional()
  @IsBoolean()
  boolAnswer?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MatchAnswerDto)
  matches?: MatchAnswerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassifyAnswerDto)
  classify?: ClassifyAnswerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAnswerDto)
  orders?: OrderAnswerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FillBlankAnswerDto)
  fillBlanks?: FillBlankAnswerDto[];
}

export class SolveAnswerDto {
  @IsUUID()
  id: UUID;

  @IsDefined()
  @ValidateNested()
  @Type(() => QuestionAnswerDto)
  answer: QuestionAnswerDto;
}
