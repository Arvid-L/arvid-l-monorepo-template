import {
  CreateExampleDto,
  Example,
  UpdateExampleDto,
} from '@arvid-l-monorepo-template/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ExampleService } from './example.service';

@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  async findAll(): Promise<Example[]> {
    return this.exampleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Example> {
    return this.exampleService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateExampleDto): Promise<Example> {
    return this.exampleService.create(createDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateExampleDto,
  ): Promise<Example> {
    return this.exampleService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.exampleService.remove(id);
  }
}
