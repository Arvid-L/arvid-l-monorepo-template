import { ExampleTable } from './tables/example.table';
import { PasswordResetTokenTable } from './tables/password-reset-token.table';
import { RefreshTokenTable } from './tables/refresh-token.table';
import { UserTable } from './tables/user.table';

export interface Database {
  examples: ExampleTable;
  password_reset_tokens: PasswordResetTokenTable;
  refresh_tokens: RefreshTokenTable;
  users: UserTable;
}
