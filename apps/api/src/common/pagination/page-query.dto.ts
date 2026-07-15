import { PageRequest } from '@arvid-l-monorepo-template/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Query-param DTO for every paginated list endpoint. The global
// ValidationPipe has transform: true, so @Type coerces the strings.
export class PageQueryDto implements PageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';
}
