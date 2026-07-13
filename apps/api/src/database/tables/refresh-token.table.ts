import { BaseTable } from './templates/base.table';

export interface RefreshTokenTable extends BaseTable {
  user_id: string;
  token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
}
