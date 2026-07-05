import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber, IsOptional, IsString } from "class-validator";

export class NumberFilterDto {
  @IsString()
  @IsOptional()
  gte?: number;
  @IsString()
  @IsOptional()
  lte?: number;
  @IsString()
  @IsOptional()
  lt?: number;
  @IsString()
  @IsOptional()
  gt?: number;
  @IsNumber()
  @IsOptional()
  not?: number;
  @IsNumber()
  @IsOptional()
  eq?: number;
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsOptional()
  in?: number[];
}