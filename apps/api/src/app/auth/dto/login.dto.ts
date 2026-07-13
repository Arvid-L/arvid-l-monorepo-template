import { LoginDto as SharedLoginDto } from '@arvid-l-monorepo-template/shared';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto implements SharedLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
