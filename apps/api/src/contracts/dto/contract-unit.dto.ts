import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateContractUnitDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsIn(['covered', 'billing', 'technical'])
  role?: 'covered' | 'billing' | 'technical';

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  bandwidthLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bandwidthMbps?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
