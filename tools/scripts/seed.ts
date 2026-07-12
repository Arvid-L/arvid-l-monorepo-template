import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// Seeds the dev database with example rows. Idempotent: does nothing when
// the table already has data. Extend per project (npm run db:seed).
// Requires the schema to exist — start the API once first (migrations run
// on boot).
config({ path: resolve(__dirname, '../../.env.dev') });

interface ExamplesSeedTable {
  name: string;
  type: string;
}

interface SeedDatabase {
  examples: ExamplesSeedTable;
}

async function seed(): Promise<void> {
  const db = new Kysely<SeedDatabase>({
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
    const existing = await db
      .selectFrom('examples')
      .select(db.fn.countAll().as('count'))
      .executeTakeFirstOrThrow();

    if (Number(existing.count) > 0) {
      console.log('examples table already has rows — nothing to seed');
      return;
    }

    await db
      .insertInto('examples')
      .values([
        { name: 'Seeded example A', type: 'type_a' },
        { name: 'Seeded example B', type: 'type_b' },
        { name: 'Seeded example C', type: 'type_c' },
      ])
      .execute();

    console.log('✓ Seeded 3 examples');
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') {
      console.error(
        'Table "examples" does not exist — start the API once so migrations run, then retry.',
      );
      process.exit(1);
    }
    throw error;
  } finally {
    await db.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
