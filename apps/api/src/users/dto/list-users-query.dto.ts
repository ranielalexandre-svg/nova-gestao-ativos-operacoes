import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { USER_ROLES } from "../user-roles";

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(USER_ROLES)
  role?: string;

  @IsOptional()
  @IsIn(["all", "true", "false"])
  active?: "all" | "true" | "false";

  @IsOptional()
  @IsIn(["createdAt", "name", "email", "role"])
  sortBy?: "createdAt" | "name" | "email" | "role";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
