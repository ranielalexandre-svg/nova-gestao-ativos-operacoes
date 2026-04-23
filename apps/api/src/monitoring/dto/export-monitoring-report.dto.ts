import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";

export class ExportMonitoringReportDto {
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  unitIds!: string[];

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @Transform(({ value }) => String(value || "pdf").trim().toLowerCase())
  @IsEnum({ pdf: "pdf", docx: "docx" })
  format: "pdf" | "docx" = "pdf";

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
