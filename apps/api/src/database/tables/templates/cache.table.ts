import { Generated } from 'kysely';

export interface CacheTable {
  created_at: Generated<Date>;
  last_accessed_at: Generated<Date>;
  access_count: Generated<number>;
}
