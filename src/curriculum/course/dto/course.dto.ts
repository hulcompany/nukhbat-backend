import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { UUID } from "crypto";

export class CourseGetDto {
    @IsString()
    @IsOptional()
    title?: string;
}

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
