import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

// The single place listing every env var the API uses. ConfigModule runs
// validateEnv() on boot and the app refuses to start with a clear error
// when something required is missing.
export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'e2e', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT?: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  // Comma-separated list of allowed origins
  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsString()
  @MinLength(16)
  JWT_SECRET!: string;

  // Anything @nestjs/jwt accepts, e.g. "15m", "12h" (default: 15m)
  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  // Refresh token lifetime in days (default: 30)
  @IsOptional()
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS?: number;

  // Public base URL of the frontend, used in links inside outgoing mails
  // (default: http://localhost:4200). In production: https://<DOMAIN>.
  @IsOptional()
  @IsString()
  APP_BASE_URL?: string;

  // SMTP — all optional. Without SMTP_HOST outgoing mail is logged instead
  // of sent (fine for dev; a warning is emitted in production).
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT?: number;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  // 'true' = implicit TLS (port 465); leave unset for STARTTLS on 587.
  // Deliberately a string: implicit conversion would turn "false" into true.
  @IsOptional()
  @IsIn(['true', 'false'])
  SMTP_SECURE?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // Compose passes unset optionals as empty strings (`${SMTP_PORT:-}`);
  // treat those as absent so @IsOptional applies instead of type checks.
  const withoutEmpty = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
  const validated = plainToInstance(EnvironmentVariables, withoutEmpty, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('\n  ');
    throw new Error(`Environment validation failed:\n  ${details}`);
  }

  return validated;
}
