import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListAutomationRunsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "success", "error", "running"])
  status?: "all" | "success" | "error" | "running";

  @IsOptional()
  @IsIn(["createdAt"])
  sortBy?: "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
