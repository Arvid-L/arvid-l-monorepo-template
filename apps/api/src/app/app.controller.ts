import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiResponse, createResponse } from '@arvid-l-monorepo-template/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  async healthCheck(): Promise<ApiResponse<{ message: string }>> {
    const result = await this.appService.healthCheck();
    return createResponse(true, 'API is running', result);
  }
}
