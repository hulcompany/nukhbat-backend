import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { LessonStatusType } from '../entity/lesson.status.type';
import { UUID } from 'crypto';

export class LessonCreateDto {
  @IsString()
  title: string;
  @IsString()
  @IsOptional()
  description?: string;
  @IsUUID()
  unitId: UUID;
}

export class LessonEditDto {
  @IsString()
  @IsOptional()
  title?: string;
  @IsString()
  @IsOptional()
  description?: string;
  @IsEnum(LessonStatusType)
  @IsOptional()
  status?: LessonStatusType;
}


export class AdminLessonGetDto {
  @IsUUID()
  @IsOptional()
  unitId?: UUID;

  // lessons carry no courseId column — filtered through unit.courseId
  @IsUUID()
  @IsOptional()
  courseId?: UUID;

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
  trackId?: UUID;
}