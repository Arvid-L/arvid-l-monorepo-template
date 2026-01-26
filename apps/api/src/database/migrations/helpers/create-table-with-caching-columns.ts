import { sql } from 'kysely';
import { Kysely } from 'kysely';

export function createTableWithCachingColumns(
  db: Kysely<any>,
  tableName: string,
) {
  return db.schema
    .createTable(tableName)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('last_accessed_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('access_count', 'integer', (col) => col.defaultTo(0).notNull());
}
