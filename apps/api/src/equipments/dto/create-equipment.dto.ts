import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEquipmentDto {
  @IsString()
  @MinLength(2)
  tag!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  type!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(["active", "stock", "repair", "retired"])
  status?: string;

  @IsString()
  unitId!: string;
}
