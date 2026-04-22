import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListPartnersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "true", "false"])
  active?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "code", "name"])
  sortBy?: "createdAt" | "code" | "name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
