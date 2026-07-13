import { ExampleTable } from './tables/example.table';
import { UserTable } from './tables/user.table';

export interface Database {
  examples: ExampleTable;
  users: UserTable;
}
