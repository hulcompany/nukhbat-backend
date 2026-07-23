import { IsOptional, IsString } from 'class-validator';

export class BookCreateDto {
  @IsString()
  name: string;
}

export class BookEditDto {
  @IsString()
  @IsOptional()
  name?: string;
}
