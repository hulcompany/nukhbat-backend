import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { OmitType } from '@nestjs/mapped-types';
import { BasePaginationDto } from 'core';
import { UUID } from 'crypto';

// School-facing attempt filter: the owner may narrow to a single student and/or
// completion state. schoolId is forced from the context, not the query.
export class AttemptGetDto extends BasePaginationDto {
  @IsOptional()
  @IsUUID()
  studentId?: UUID;

  // query strings arrive as 'true'/'false'
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  completed?: boolean;
}

// Student-facing: studentId is forced from the context — a real class (not a TS
// Omit<>) so ValidationPipe still whitelists the query.
export class AttemptStudentGetDto extends OmitType(AttemptGetDto, [
  'studentId',
] as const) {}
