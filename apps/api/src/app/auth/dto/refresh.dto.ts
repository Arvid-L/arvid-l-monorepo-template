import { RefreshDto as SharedRefreshDto } from '@arvid-l-monorepo-template/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto implements SharedRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
