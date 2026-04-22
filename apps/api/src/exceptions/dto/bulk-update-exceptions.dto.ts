import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class BulkUpdateExceptionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(2, { each: true })
  ids!: string[];

  @IsString()
  @IsIn(["ack", "resolve", "reopen", "silence_1h", "assign", "unassign"])
  action!: "ack" | "resolve" | "reopen" | "silence_1h" | "assign" | "unassign";

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  silencedUntil?: string;
}
