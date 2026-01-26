import { Pool } from 'pg';
import {
  Kysely,
  PostgresDialect,
  Migrator,
  MigrationProvider,
  Migration,
} from 'kysely';
import { migrations } from './migrations/_all-migrations';
import { Logger } from '@nestjs/common';

class ImportMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

export async function runMigrations() {
  const logger = new Logger(Migrator.name);
  logger.log('Running database migrations...');

  const db = new Kysely({
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

  const migrator = new Migrator({
    db,
    provider: new ImportMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      logger.log(`✓ Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === 'Error') {
      logger.error(`✗ Migration "${it.migrationName}" failed`);
    }
  });

  if (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }

  await db.destroy();
  logger.log('All migrations completed');
}
