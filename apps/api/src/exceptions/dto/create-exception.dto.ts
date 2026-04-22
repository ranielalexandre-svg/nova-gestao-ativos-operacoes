import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateExceptionDto {
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
  @IsIn(["generic", "sla", "integration", "occurrence", "maintenance", "automation"])
  kind?: string;

  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "critical"])
  severity?: string;

  @IsOptional()
  @IsString()
  @IsIn(["open", "acknowledged", "resolved", "silenced"])
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  silencedUntil?: string;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsString()
  occurrenceId?: string;

  @IsOptional()
  @IsString()
  maintenanceId?: string;
}
