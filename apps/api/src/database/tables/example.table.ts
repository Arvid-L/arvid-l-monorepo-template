import { BaseTable } from './templates/base.table';
import { ExampleType } from '@arvid-l-monorepo-template/shared';

export interface ExampleTable extends BaseTable {
  name: string;
  type: ExampleType;
}
