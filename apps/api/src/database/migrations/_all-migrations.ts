import type { Migration } from 'kysely';

import * as migration_001_example from './001_create_examples_table';
import * as migration_002_users from './002_create_users_table';
import * as migration_003_refresh_tokens from './003_create_refresh_tokens_table';

export const migrations: Record<string, Migration> = {
  migration_001_example,
  migration_002_users,
  migration_003_refresh_tokens,
};
