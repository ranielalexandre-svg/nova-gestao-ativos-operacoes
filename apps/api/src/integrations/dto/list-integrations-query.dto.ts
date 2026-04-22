import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListIntegrationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(["all", "true", "false"])
  active?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["all", "zabbix", "generic_http"])
  type?: "all" | "zabbix" | "generic_http";

  @IsOptional()
  @IsIn(["createdAt", "code", "name", "type"])
  sortBy?: "createdAt" | "code" | "name" | "type";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
