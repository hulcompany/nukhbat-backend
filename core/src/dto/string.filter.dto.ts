import { IsArray, IsOptional, IsString } from 'class-validator';

export class StringFilterDto {
  @IsString()
  @IsOptional()
  eq?: string;

  @IsString()
  @IsOptional()
  not?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  in?: string[];

  @IsString()
  @IsOptional()
  contains?: string;

  @IsString()
  @IsOptional()
  startsWith?: string;

  @IsString()
  @IsOptional()
  endsWith?: string;

  @IsString()
  @IsOptional()
  regex?: string;
}
