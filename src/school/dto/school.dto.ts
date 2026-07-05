import { IsOptional, IsString } from 'class-validator';
import { UserMainDto } from '../../core/user/dto/user-main.dto';

export class SchoolEditDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class SchoolCreateDto extends UserMainDto {
  @IsString()
  schoolName: string;
}
