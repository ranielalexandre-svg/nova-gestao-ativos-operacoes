import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(["maintenance_overdue", "critical_open_occurrence", "integration_failure", "aged_open_occurrence"])
  detector?: string;

  @IsOptional()
  @IsString()
  @IsIn(["low", "medium", "high", "critical"])
  severity?: string;

  @IsOptional()
  @IsString()
  @IsIn(["every_minute", "every_5_minutes", "hourly"])
  cadence?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  thresholdMinutes?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  createExceptions?: boolean;

  @IsOptional()
  @IsBoolean()
  createActivities?: boolean;

  @IsOptional()
  @IsBoolean()
  resolveOnRecovery?: boolean;
}
