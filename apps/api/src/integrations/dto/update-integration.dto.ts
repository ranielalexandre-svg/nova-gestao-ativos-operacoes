import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class UpdateIntegrationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(["zabbix", "generic_http"])
  type?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiPath?: string;

  @IsOptional()
  @IsString()
  @IsIn(["none", "token", "userpass"])
  authMode?: string;

  @IsOptional()
  @IsString()
  apiToken?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
