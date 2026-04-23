import { IsString } from "class-validator";

export class ZabbixReportGroupsQueryDto {
  @IsString()
  integrationId!: string;
}
