import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { UUID } from 'crypto';
import { QuestionGetDto } from '../questions/dto/question.dto';

export class AdminCourseGetDto {
  // case-insensitive contains
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsUUID()
  @IsOptional()
  trackId?: UUID;
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

export class AdminQuestionGetDto extends QuestionGetDto {
  @IsUUID()
  @IsOptional()
  schoolId?: UUID;

  @IsUUID()
  @IsOptional()
  trackId?: UUID;
}
