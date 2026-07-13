import { VerifyEmailDto as SharedVerifyEmailDto } from '@arvid-l-monorepo-template/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto implements SharedVerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
