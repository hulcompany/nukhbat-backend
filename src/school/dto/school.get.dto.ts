import { IsOptional, IsString } from 'class-validator';
import { BasePaginationDto } from 'core';

export class SchoolGetDto extends BasePaginationDto {
  @IsString()
  @IsOptional()
  name?: string;
}
