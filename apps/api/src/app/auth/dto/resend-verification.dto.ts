import { ResendVerificationDto as SharedResendVerificationDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto implements SharedResendVerificationDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;
}
