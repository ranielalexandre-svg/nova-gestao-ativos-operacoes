import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListUnitsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsIn(["all", "true", "false"])
  active?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "code", "name", "city", "state"])
  sortBy?: "createdAt" | "code" | "name" | "city" | "state";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
