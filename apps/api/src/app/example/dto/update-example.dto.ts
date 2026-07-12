import {
  UpdateExampleDto as SharedUpdateExampleDto,
  ExampleType,
} from '@arvid-l-monorepo-template/shared';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateExampleDto implements SharedUpdateExampleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(ExampleType)
  type?: ExampleType;
}
