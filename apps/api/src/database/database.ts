import { ExampleTable } from './tables/example.table';
import { RefreshTokenTable } from './tables/refresh-token.table';
import { UserTable } from './tables/user.table';

export interface Database {
  examples: ExampleTable;
  refresh_tokens: RefreshTokenTable;
  users: UserTable;
}
