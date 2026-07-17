import { ChangeEmailDto as SharedChangeEmailDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class ChangeEmailDto implements SharedChangeEmailDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  newEmail!: string;

  @IsString()
  password!: string;
}
