import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DATABASE } from '../database/database.module';
import { createTestDatabase } from './app.service.spec';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DATABASE, useValue: createTestDatabase() },
      ],
    }).compile();
  });

  describe('healthCheck', () => {
    it('should return a healthy ApiResponse envelope', async () => {
      const appController = app.get<AppController>(AppController);
      const expected = {
        success: true,
        data: {
          message: 'Healthy',
        },
        message: 'API is running',
        timestamp: expect.any(Date),
      };
      const result = await appController.healthCheck();

      expect(result).toEqual(expected);
    });
  });
});
