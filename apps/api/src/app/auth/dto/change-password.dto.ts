import { ChangePasswordDto as SharedChangePasswordDto } from '@arvid-l-monorepo-template/shared';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto implements SharedChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
