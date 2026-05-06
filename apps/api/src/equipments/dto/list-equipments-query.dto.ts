import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListEquipmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(["all", "true", "false"])
  active?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "tag", "name", "type", "status"])
  sortBy?: "createdAt" | "tag" | "name" | "type" | "status";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
