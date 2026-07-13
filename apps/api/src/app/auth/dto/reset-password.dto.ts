import { ResetPasswordDto as SharedResetPasswordDto } from '@arvid-l-monorepo-template/shared';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto implements SharedResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
