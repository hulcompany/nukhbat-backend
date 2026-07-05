import { IsLatitude, IsLongitude, IsNotEmpty } from "class-validator";

export class LatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}