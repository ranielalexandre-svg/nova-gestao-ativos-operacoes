import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListActivitiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "note", "event", "exception", "automation", "system"])
  kind?: "all" | "note" | "event" | "exception" | "automation" | "system";

  @IsOptional()
  @IsIn(["all", "manual", "automation", "exception"])
  source?: "all" | "manual" | "automation" | "exception";

  @IsOptional()
  @IsIn(["all", "info", "low", "medium", "high", "critical"])
  severity?: "all" | "info" | "low" | "medium" | "high" | "critical";

  @IsOptional()
  @IsIn(["createdAt", "updatedAt", "severity", "kind", "source"])
  sortBy?: "createdAt" | "updatedAt" | "severity" | "kind" | "source";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
