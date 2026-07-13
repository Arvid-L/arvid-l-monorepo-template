import { Kysely } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
} from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  await createTableWithBaseColumns(db, 'refresh_tokens')
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'varchar(128)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('refresh_tokens_user_id_idx')
    .on('refresh_tokens')
    .column('user_id')
    .execute();

  await addUpdatedAtTrigger(db, 'refresh_tokens');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'refresh_tokens');
  await db.schema.dropTable('refresh_tokens').ifExists().execute();
}
