import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListMaintenancesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsIn(["all", "preventive", "corrective", "inspection"])
  type?: "all" | "preventive" | "corrective" | "inspection";

  @IsOptional()
  @IsIn(["all", "planned", "in_progress", "done", "cancelled"])
  status?: "all" | "planned" | "in_progress" | "done" | "cancelled";

  @IsOptional()
  @IsIn(["createdAt", "code", "title", "type", "status"])
  sortBy?: "createdAt" | "code" | "title" | "type" | "status";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
