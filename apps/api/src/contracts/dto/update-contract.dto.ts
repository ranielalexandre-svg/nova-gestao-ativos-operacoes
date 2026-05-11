import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'expired', 'cancelled'])
  status?: 'draft' | 'active' | 'expired' | 'cancelled';

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyValueCents?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  billingCycle?: string;

  @IsOptional()
  @IsString()
  adjustmentIndex?: string;

  @IsOptional()
  @IsString()
  renewalMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  loyaltyMonths?: number;

  @IsOptional()
  @IsString()
  terminationPenalty?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  slaPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
