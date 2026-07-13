// Must stay the first import — see config/load-env.ts
import './config/load-env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { runMigrations } from './database/migrator';

async function bootstrap() {
  // bufferLogs: hold startup logs until pino replaces the default logger
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const globalPrefix = 'api';
  app.useLogger(app.get(PinoLogger));

  // Behind the edge nginx: derive client IPs from X-Forwarded-For so
  // rate limiting applies per client, not per proxy.
  app.set('trust proxy', 1);

  await runMigrations();

  const isProduction = process.env.NODE_ENV === 'production';
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
