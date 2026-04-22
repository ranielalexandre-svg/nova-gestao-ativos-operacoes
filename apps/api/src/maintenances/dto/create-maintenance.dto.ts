import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateMaintenanceDto {
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
  @IsIn(["preventive", "corrective", "inspection"])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(["planned", "in_progress", "done", "cancelled"])
  status?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  completedAt?: string;

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
  occurrenceId?: string;
}
