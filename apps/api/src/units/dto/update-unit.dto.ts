import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
