import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateExceptionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

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
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  silencedUntil?: string;
}
