import { Kysely, sql } from 'kysely';
import { createEnum, dropEnum } from './helpers';

// Roles are a Postgres enum so invalid values are impossible at the DB level.
// Add future roles with the addEnumValue() helper in a new migration and
// extend UserRole + USER_ROLE_RANK in libs/shared.
export async function up(db: Kysely<any>): Promise<void> {
  await createEnum(db, 'user_role', ['admin', 'moderator', 'user']);

  await db.schema
    .alterTable('users')
    .addColumn('role', sql`user_role`, (col) => col.notNull().defaultTo('user'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('role').execute();
  await dropEnum(db, 'user_role');
}
