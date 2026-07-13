import { Kysely, sql } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
} from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  // Existing users are backfilled as verified — running deployments must
  // not lock their users out when this migration lands.
  await db.schema
    .alterTable('users')
    .addColumn('email_verified_at', 'timestamptz')
    .execute();
  await db
    .updateTable('users')
    .set({ email_verified_at: sql`now()` })
    .execute();

  await createTableWithBaseColumns(db, 'email_verification_tokens')
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'varchar(128)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('used_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('email_verification_tokens_user_id_idx')
    .on('email_verification_tokens')
    .column('user_id')
    .execute();

  await addUpdatedAtTrigger(db, 'email_verification_tokens');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'email_verification_tokens');
  await db.schema.dropTable('email_verification_tokens').ifExists().execute();
  await db.schema.alterTable('users').dropColumn('email_verified_at').execute();
}
