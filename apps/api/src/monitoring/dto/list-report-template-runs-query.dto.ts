import { IsOptional, IsString } from "class-validator";

export class ListReportTemplateRunsQueryDto {
  @IsOptional()
  @IsString()
  templateId?: string;
}
