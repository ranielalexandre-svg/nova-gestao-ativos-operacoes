import { IsIn, IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class CreateIntegrationDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsIn(["zabbix", "generic_http"])
  type!: string;

  @IsString()
  @IsUrl({ require_tld: false })
  baseUrl!: string;

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
}
