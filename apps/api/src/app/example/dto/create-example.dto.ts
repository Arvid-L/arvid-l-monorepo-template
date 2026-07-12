import {
  CreateExampleDto as SharedCreateExampleDto,
  ExampleType,
} from '@arvid-l-monorepo-template/shared';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

// Validated request class for the shared DTO contract. The shared lib stays
// a plain-interface contract (no class-validator in the frontend bundle);
// the API implements it with validation decorators.
export class CreateExampleDto implements SharedCreateExampleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ExampleType)
  type!: ExampleType;
}
