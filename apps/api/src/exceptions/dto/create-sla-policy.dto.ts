import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateSlaPolicyDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(["generic", "sla", "integration", "occurrence", "maintenance", "automation"])
  kind?: string;

  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "critical"])
  severity?: string;

  @IsOptional()
  @IsString()
  queueKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  firstResponseMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  resolveMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
