import { UpdateUserStatusDto as SharedUpdateUserStatusDto } from '@arvid-l-monorepo-template/shared';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto implements SharedUpdateUserStatusDto {
  @IsBoolean()
  disabled!: boolean;
}
