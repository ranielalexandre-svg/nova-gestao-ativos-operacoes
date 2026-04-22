import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  handoffId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(["note", "event", "handoff", "occurrence", "maintenance", "system"])
  kind?: string;

  @IsOptional()
  @IsString()
  @IsIn(["info", "low", "medium", "high", "critical"])
  severity?: string;
}
