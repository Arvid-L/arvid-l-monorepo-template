import { ExampleType } from '../enums';

export interface CreateExampleDto {
  name: string;
  type: ExampleType;
}

export interface UpdateExampleDto {
  name?: string;
  type?: ExampleType;
}
