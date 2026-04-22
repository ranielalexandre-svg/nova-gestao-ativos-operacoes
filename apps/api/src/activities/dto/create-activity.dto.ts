import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateActivityDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(["note", "event", "exception", "automation", "system"])
  kind?: string;

  @IsOptional()
  @IsString()
  @IsIn(["manual", "automation", "exception"])
  source?: string;

  @IsOptional()
  @IsString()
  @IsIn(["info", "low", "medium", "high", "critical"])
  severity?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  exceptionId?: string;

  @IsOptional()
  @IsString()
  automationId?: string;

  @IsOptional()
  @IsString()
  automationRunId?: string;

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
