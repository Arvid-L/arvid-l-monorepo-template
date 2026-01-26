import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { runMigrations } from './database/migrator';
import { config } from 'dotenv';
import { resolve } from 'path';

const NODE_ENV_FILE_RECORD: Record<string, string> = {
  development: '.env.dev',
  e2e: '.env.e2e',
  production: '.env',
};
config({
  path: resolve(process.cwd(), NODE_ENV_FILE_RECORD[process.env.NODE_ENV]),
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  const logger = app.get(Logger);

  await runMigrations();

  app.useLogger(logger);
  app.setGlobalPrefix(globalPrefix);
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
