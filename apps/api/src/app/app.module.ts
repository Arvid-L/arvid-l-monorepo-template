import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ExampleModule } from './example/example.module';
import { DatabaseModule } from '../database/database.module';
import { LoggerMiddleware } from '../common/middleware/logger.middleware';
import { validateEnv } from '../config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Generous global rate limit per client IP; credential endpoints add a
    // strict @Throttle override (see auth.controller). Requires the
    // 'trust proxy' setting in main.ts to see real IPs behind nginx.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    ExampleModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    Logger,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('{*splat}');
  }
}
