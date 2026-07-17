import { RegisterDto as SharedRegisterDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto implements SharedRegisterDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  // GDPR: consent must be an explicit action — the API refuses without it.
  @Equals(true)
  privacyAccepted!: boolean;
}
