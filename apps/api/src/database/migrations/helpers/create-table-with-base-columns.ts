import { sql } from 'kysely';
import { Kysely } from 'kysely';

export function createTableWithBaseColumns(db: Kysely<any>, tableName: string) {
  return db.schema
    .createTable(tableName)
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('deleted_at', 'timestamptz');
}
