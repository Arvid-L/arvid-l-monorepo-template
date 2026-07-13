import { Module } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ExampleModule } from './example/example.module';
import { DatabaseModule } from '../database/database.module';
import { validateEnv } from '../config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Structured logging: JSON lines in production (greppable, one request
    // = one line with a correlation id), pretty-printed in dev. Everything
    // logged through the normal Nest `Logger` ends up here too.
    LoggerModule.forRoot({
      pinoHttp: {
        // Correlate all log lines of one request; honor an upstream
        // X-Request-Id (e.g. from nginx) when present.
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) ?? randomUUID(),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        // Health checks every 30s would drown out real traffic
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        ...(process.env.NODE_ENV !== 'production' && {
          transport: {
            target: 'pino-pretty',
            options: { singleLine: true },
          },
        }),
      },
    }),
    // Generous global rate limit per client IP; credential endpoints add a
    // strict @Throttle override (see auth.controller). Requires the
    // 'trust proxy' setting in main.ts to see real IPs behind nginx.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // Enables @Cron() jobs (e.g. auth/token-cleanup.service)
    ScheduleModule.forRoot(),
    AuthModule,
    ExampleModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
