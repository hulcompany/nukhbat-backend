import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { BasePaginationDto } from 'core';
import { UUID } from 'crypto';

// only the owning school edits a profile — for now just the active flag
export class StudentActivationEditDto {
  @IsBoolean()
  active: boolean;
}

export class StudentProfileGetDto extends BasePaginationDto {
  @IsUUID()
  @IsOptional()
  trackId?: UUID;

  @IsUUID()
  @IsOptional()
  schoolId?: UUID;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;
}

// owner route: schoolId comes from the context — a real class (not a TS
// Omit<>) so ValidationPipe still validates and whitelists the query
export class StudentProfileSchoolGetDto extends OmitType(
  StudentProfileGetDto,
  ['schoolId'] as const,
) {}
