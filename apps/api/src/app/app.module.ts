import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ExampleModule } from './example/example.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ExampleModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService, Logger],
})
export class AppModule {}
