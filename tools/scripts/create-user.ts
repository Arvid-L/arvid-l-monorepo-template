import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { hashPassword } from '../../apps/api/src/app/auth/password.util';

// Creates (or updates the password/role of) a user in the dev database.
// Usage: pnpm run user:create <email> <password> [admin|moderator|user]
// For production, run on the server against the compose DB, e.g.:
//   DATABASE_HOST=127.0.0.1 DATABASE_NAME=... DATABASE_USER=... \
//   DATABASE_PASSWORD=... pnpm exec tsx tools/scripts/create-user.ts <email> <pw> admin
if (!process.env.DATABASE_HOST) {
  config({ path: resolve(__dirname, '../../.env.dev') });
}

const VALID_ROLES = ['admin', 'moderator', 'user'];
const [rawEmail, password, role] = process.argv.slice(2);
// The API stores and matches emails lowercase — keep this script consistent.
const email = rawEmail?.trim().toLowerCase();

if (!email || !password || (role && !VALID_ROLES.includes(role))) {
  console.error(
    'Usage: pnpm run user:create <email> <password> [admin|moderator|user]',
  );
  process.exit(1);
}

async function createUser(): Promise<void> {
  const db = new Kysely<{
    users: {
      email: string;
      password_hash: string;
      role: string;
      email_verified_at: string;
    };
  }>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
      }),
    }),
  });

  try {
    await db
      .insertInto('users')
      .values({
        email,
        password_hash: hashPassword(password),
        role: role ?? 'user',
        // Bootstrap/admin path must never end up behind the login gate.
        email_verified_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          password_hash: hashPassword(password),
          email_verified_at: new Date().toISOString(),
          // Only touch the role of an existing user when explicitly given —
          // a plain password reset must not demote an admin.
          ...(role ? { role } : {}),
        }),
      )
      .execute();

    console.log(`✓ User ${email} created/updated${role ? ` (${role})` : ''}`);
  } finally {
    await db.destroy();
  }
}

createUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
