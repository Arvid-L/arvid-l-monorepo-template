import { ForgotPasswordDto as SharedForgotPasswordDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto implements SharedForgotPasswordDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
}
