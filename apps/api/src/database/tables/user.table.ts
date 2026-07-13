import { Generated } from 'kysely';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { BaseTable } from './templates/base.table';

export interface UserTable extends BaseTable {
  email: string;
  password_hash: string;
  role: Generated<UserRole>;
}
