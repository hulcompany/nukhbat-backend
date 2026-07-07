import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { BasePaginationDto } from 'core';
import { UUID } from 'crypto';

export class SubscriptionKeyCreateDto {
  @IsUUID()
  trackId: UUID;

  @IsUUID()
  @IsOptional()
  schoolId?: UUID;
}

export class SubscriptionKeyCreateManyDto extends SubscriptionKeyCreateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count: number;
}

export class SubscriptionKeyGetDto extends BasePaginationDto {
  @IsUUID()
  @IsOptional()
  trackId?: UUID;

  @IsUUID()
  @IsOptional()
  schoolId?: UUID;
}

// owner route: schoolId comes from the context — a real class (not a TS
// Omit<>) so ValidationPipe still validates and whitelists the query
export class SubscriptionKeySchoolGetDto extends OmitType(
  SubscriptionKeyGetDto,
  ['schoolId'] as const,
) {}

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  key: string;
}
