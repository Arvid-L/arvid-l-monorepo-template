import type { Migration } from 'kysely';

import * as migration_001_example from './001_create_examples_table';
import * as migration_002_users from './002_create_users_table';
import * as migration_003_refresh_tokens from './003_create_refresh_tokens_table';
import * as migration_004_user_roles from './004_add_role_to_users';
import * as migration_005_password_reset_tokens from './005_create_password_reset_tokens_table';
import * as migration_006_email_verification from './006_add_email_verification';

export const migrations: Record<string, Migration> = {
  migration_001_example,
  migration_002_users,
  migration_003_refresh_tokens,
  migration_004_user_roles,
  migration_005_password_reset_tokens,
  migration_006_email_verification,
};
