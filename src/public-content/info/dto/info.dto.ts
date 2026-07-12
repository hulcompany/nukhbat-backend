import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { LatLngDto } from '../../../common';
import { Type } from 'class-transformer';

export class InfoDto {
  @IsUrl()
  @IsOptional()
  googlePlay?: string;
  @IsUrl()
  @IsOptional()
  appStore?: string;
  @IsPhoneNumber('SY')
  @IsOptional()
  phone?: string;
  @IsString()
  @IsOptional()
  location?: string;
  @ValidateNested()
  @IsOptional()
  @Type(() => LatLngDto)
  position?: LatLngDto;
  @IsString()
  @IsOptional()
  about?: string;
  @IsString()
  @IsOptional()
  privacyPolicy?: string;
  @IsString()
  @IsOptional()
  termsAndConditions?: string;
}
