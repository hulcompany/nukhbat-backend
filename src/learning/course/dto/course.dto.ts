import { IsOptional, IsString, IsUUID } from "class-validator";
import { UUID } from "crypto";

export class CourseGetDto {
    @IsString()
    @IsOptional()
    title?: string;
}