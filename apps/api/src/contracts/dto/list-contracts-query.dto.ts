import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListContractsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsIn(['all', 'draft', 'active', 'expired', 'cancelled'])
  status?: 'all' | 'draft' | 'active' | 'expired' | 'cancelled';

  @IsOptional()
  @IsIn(['createdAt', 'code', 'startsAt', 'endsAt', 'status'])
  sortBy?: 'createdAt' | 'code' | 'startsAt' | 'endsAt' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
