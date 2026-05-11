import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class UpsertContractBillingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  referenceMonth!: string;

  @IsOptional()
  @IsIn(['open', 'paid', 'overdue', 'cancelled'])
  status?: 'open' | 'paid' | 'overdue' | 'cancelled';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountCents?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
