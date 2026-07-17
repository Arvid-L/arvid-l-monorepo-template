import { DeleteAccountDto as SharedDeleteAccountDto } from '@arvid-l-monorepo-template/shared';
import { IsString } from 'class-validator';

export class DeleteAccountDto implements SharedDeleteAccountDto {
  @IsString()
  password!: string;
}
