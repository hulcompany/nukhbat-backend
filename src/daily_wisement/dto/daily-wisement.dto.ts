import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { BasePaginationDto } from 'core';

export class DailyWisementCreateDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class DailyWisementEditDto extends PartialType(DailyWisementCreateDto) {}

export class DailyWisementBulkCreateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DailyWisementCreateDto)
  items: DailyWisementCreateDto[];
}

export class DailyWisementGetDto extends BasePaginationDto {
  @IsString()
  @IsOptional()
  text?: string;
}
