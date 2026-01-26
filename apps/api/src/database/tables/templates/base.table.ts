import { Generated, GeneratedAlways } from 'kysely';

export interface BaseTable {
  id: GeneratedAlways<string>;
  created_at: GeneratedAlways<string>;
  updated_at: Generated<string>;
  deleted_at: string | null;
}
