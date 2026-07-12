import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { runMigrations } from './database/migrator';
import { config } from 'dotenv';
import { resolve } from 'path';

// In containers the environment is injected directly and no env file exists;
// dotenv silently no-ops on a missing file.
const NODE_ENV_FILE_RECORD: Record<string, string> = {
  development: '.env.dev',
  e2e: '.env.e2e',
  production: '.env.production',
};
config({
  path: resolve(
    process.cwd(),
    NODE_ENV_FILE_RECORD[process.env.NODE_ENV ?? 'development'] ?? '.env.dev',
  ),
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  const logger = app.get(Logger);

  await runMigrations();

  app.useLogger(logger);
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Comma-separated list, e.g. CORS_ORIGIN=https://example.org,https://www.example.org
  const corsOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : 'http://localhost:4200',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
