import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListOccurrencesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsIn(["all", "low", "medium", "high", "critical"])
  severity?: "all" | "low" | "medium" | "high" | "critical";

  @IsOptional()
  @IsIn(["all", "open", "investigating", "resolved", "cancelled"])
  status?: "all" | "open" | "investigating" | "resolved" | "cancelled";

  @IsOptional()
  @IsIn(["createdAt", "code", "title", "severity", "status"])
  sortBy?: "createdAt" | "code" | "title" | "severity" | "status";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
