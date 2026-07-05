import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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
