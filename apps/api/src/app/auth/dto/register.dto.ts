import { RegisterDto as SharedRegisterDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
}
