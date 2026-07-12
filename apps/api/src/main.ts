import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
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

  const isProduction = process.env.NODE_ENV === 'production';

  app.useLogger(logger);
  app.use(
    helmet({
      // CSP would break the Swagger UI, which only exists outside production
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
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

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup(
      `${globalPrefix}/docs`,
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
