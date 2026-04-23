import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

function csvArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export class CreateReportTemplateDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @Transform(({ value }) => String(value || "manual").trim().toLowerCase())
  @IsEnum({ manual: "manual", zabbix_group: "zabbix_group" })
  sourceType: "manual" | "zabbix_group" = "manual";

  @IsOptional()
  @Transform(({ value }) => csvArray(value))
  @IsArray()
  @IsString({ each: true })
  unitIds: string[] = [];

  @IsOptional()
  @Transform(({ value }) => csvArray(value))
  @IsArray()
  @IsString({ each: true })
  groupIds: string[] = [];

  @Transform(({ value }) => String(value || "last_7_days").trim().toLowerCase())
  @IsEnum({ last_7_days: "last_7_days", current_month: "current_month", previous_month: "previous_month" })
  periodPreset: "last_7_days" | "current_month" | "previous_month" = "last_7_days";

  @Transform(({ value }) => String(value || "pdf").trim().toLowerCase())
  @IsEnum({ pdf: "pdf", docx: "docx" })
  outputFormat: "pdf" | "docx" = "pdf";

  @Transform(({ value }) => value === true || value === "true" || value === "on" || value === "1")
  @IsBoolean()
  includeCharts = true;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  interestedParty?: string;

  @IsOptional()
  @IsString()
  contractLabel?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  contractedBandwidth?: string;
}
