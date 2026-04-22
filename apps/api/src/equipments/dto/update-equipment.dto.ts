import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  tag?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  type?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(["active", "stock", "repair", "retired"])
  status?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
