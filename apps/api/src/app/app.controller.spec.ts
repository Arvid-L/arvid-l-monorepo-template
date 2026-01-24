import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
  });

  describe('getData', () => {
    it('should return "Hello API"', () => {
      const appController = app.get<AppController>(AppController);
      const expected = {
        success: true,
        data: {
          message: 'Healthy',
        },
        message: 'API is running',
        timestamp: expect.any(Date),
      };
      const result = appController.healthCheck();

      expect(result).toEqual(expected);
    });
  });
});
