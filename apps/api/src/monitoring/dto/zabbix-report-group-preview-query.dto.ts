import { Transform } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class ZabbixReportGroupPreviewQueryDto {
  @IsString()
  integrationId!: string;

  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  groupIds!: string[];
}
