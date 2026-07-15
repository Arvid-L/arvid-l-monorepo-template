import { BaseTable } from './templates/base.table';

export interface EmailVerificationTokenTable extends BaseTable {
  user_id: string;
  token_hash: string;
  expires_at: string | Date;
  used_at: string | Date | null;
  new_email: string | null;
}
