import { IsNotEmpty, IsString } from "class-validator";

export class UserVerifyDto {
    @IsString()
    @IsNotEmpty()
    code: string;
}