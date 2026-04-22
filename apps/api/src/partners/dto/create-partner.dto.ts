import { IsString, MinLength } from "class-validator";

export class CreatePartnerDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
