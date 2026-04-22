import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOccurrenceDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "critical"])
  severity?: string;

  @IsOptional()
  @IsString()
  @IsIn(["open", "investigating", "resolved", "cancelled"])
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;
}
