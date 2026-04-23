import { IsOptional, IsString } from "class-validator";

export class PrtgStyleReportQueryDto {
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
