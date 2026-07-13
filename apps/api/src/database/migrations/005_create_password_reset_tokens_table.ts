import { Kysely } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
} from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  await createTableWithBaseColumns(db, 'password_reset_tokens')
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'varchar(128)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('used_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('password_reset_tokens_user_id_idx')
    .on('password_reset_tokens')
    .column('user_id')
    .execute();

  await addUpdatedAtTrigger(db, 'password_reset_tokens');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'password_reset_tokens');
  await db.schema.dropTable('password_reset_tokens').ifExists().execute();
}
