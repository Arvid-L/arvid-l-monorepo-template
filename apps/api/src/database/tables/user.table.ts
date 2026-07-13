import { BaseTable } from './templates/base.table';

export interface UserTable extends BaseTable {
  email: string;
  password_hash: string;
}
