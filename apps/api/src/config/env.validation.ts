import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
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
