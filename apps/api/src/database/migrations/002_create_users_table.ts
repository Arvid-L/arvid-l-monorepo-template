import { Kysely } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
} from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  await createTableWithBaseColumns(db, 'users')
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .execute();

  await addUpdatedAtTrigger(db, 'users');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'users');
  await db.schema.dropTable('users').ifExists().execute();
}
