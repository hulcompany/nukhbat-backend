import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { UUID } from 'crypto';

export class UnitCreateDto {
  @IsString()
  title: string;

  @IsUUID()
  courseId: UUID;
}

export class UnitUpdateDto {
  @IsString()
  @IsOptional()
  title: string;
}

export class UnitGetDto {
  @IsString()
  @IsOptional()
  title?: string;
}


export class AdminUnitGetDto {
  @IsUUID()
  @IsOptional()
  schoolId?: UUID;

  // case-insensitive contains
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsUUID()
  @IsOptional()
  courseId?: UUID;

  @IsUUID()
  @IsOptional()
  trackId?: UUID;
}

