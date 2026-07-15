import { Example, PageResponse } from '@arvid-l-monorepo-template/shared';
import { CreateExampleDto, UpdateExampleDto } from './dto';
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
  Query,
} from '@nestjs/common';
import { ExampleService } from './example.service';
import { PageQueryDto } from '../../common/pagination/page-query.dto';

@Controller('examples')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  async findAll(@Query() query: PageQueryDto): Promise<PageResponse<Example>> {
    return this.exampleService.findAll(query);
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
