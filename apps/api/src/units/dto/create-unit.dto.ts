import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  partnerId!: string;

  @IsOptional()
  @IsString()
  reportContractLabel?: string;

  @IsOptional()
  @IsString()
  reportAddressLine?: string;

  @IsOptional()
  @IsString()
  reportContractedBandwidth?: string;

  @IsOptional()
  @IsString()
  reportNotes?: string;
}
