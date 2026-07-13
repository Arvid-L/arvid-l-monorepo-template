import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';
import { hashPassword } from '../../apps/api/src/app/auth/password.util';

// Creates (or updates the password of) a user in the dev database.
// Usage: npm run user:create -- <email> <password>
// For production, run on the server against the compose DB, e.g.:
//   DATABASE_HOST=127.0.0.1 DATABASE_NAME=... DATABASE_USER=... \
//   DATABASE_PASSWORD=... npx tsx tools/scripts/create-user.ts <email> <pw>
if (!process.env.DATABASE_HOST) {
  config({ path: resolve(__dirname, '../../.env.dev') });
}

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run user:create -- <email> <password>');
  process.exit(1);
}

async function createUser(): Promise<void> {
  const db = new Kysely<{
    users: { email: string; password_hash: string };
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
      .values({ email, password_hash: hashPassword(password) })
      .onConflict((oc) =>
        oc
          .column('email')
          .doUpdateSet({ password_hash: hashPassword(password) }),
      )
      .execute();

    console.log(`✓ User ${email} created/updated`);
  } finally {
    await db.destroy();
  }
}

createUser().catch((error) => {
  console.error(error);
  process.exit(1);
});
