import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListAutomationRulesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "maintenance_overdue", "critical_open_occurrence", "integration_failure", "aged_open_occurrence", "monitoring_report_export"])
  detector?: "all" | "maintenance_overdue" | "critical_open_occurrence" | "integration_failure" | "aged_open_occurrence" | "monitoring_report_export";

  @IsOptional()
  @IsIn(["all", "true", "false"])
  enabled?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "code", "detector", "cadence"])
  sortBy?: "createdAt" | "code" | "detector" | "cadence";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
