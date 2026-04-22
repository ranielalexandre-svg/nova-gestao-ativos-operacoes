import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListExceptionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "generic", "sla", "integration", "occurrence", "maintenance", "automation"])
  kind?: "all" | "generic" | "sla" | "integration" | "occurrence" | "maintenance" | "automation";

  @IsOptional()
  @IsIn(["all", "low", "medium", "high", "critical"])
  severity?: "all" | "low" | "medium" | "high" | "critical";

  @IsOptional()
  @IsIn(["all", "open", "acknowledged", "resolved", "silenced"])
  status?: "all" | "open" | "acknowledged" | "resolved" | "silenced";

  @IsOptional()
  @IsIn(["all", "manual", "automation"])
  source?: "all" | "manual" | "automation";

  @IsOptional()
  @IsIn(["all", "pending", "triaged", "closed"])
  triageStatus?: "all" | "pending" | "triaged" | "closed";

  @IsOptional()
  @IsString()
  queueKey?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  onlyBreached?: "true" | "false";

  @IsOptional()
  @IsIn(["true", "false"])
  onlyDueSoon?: "true" | "false";

  @IsOptional()
  @IsIn(["true", "false"])
  onlyUnassigned?: "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "severity", "status", "priorityScore", "resolveDueAt"])
  sortBy?: "createdAt" | "severity" | "status" | "priorityScore" | "resolveDueAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
