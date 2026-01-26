import * as fs from 'fs';
import * as path from 'path';

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: npm run migration:create <migration-name>');
  process.exit(1);
}

const migrationsDir = path.join(
  __dirname,
  '../../apps/api/src/database/migrations',
);

let highestNumber = 0;
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir);
  files.forEach((file) => {
    const match = file.match(/^(\d+)_/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > highestNumber) {
        highestNumber = num;
      }
    }
  });
}

const filename = `${(highestNumber + 1).toString().padStart(3, '0')}_${migrationName}.ts`;

const template = `import { Kysely } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
} from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  await createTableWithBaseColumns(db, '${migrationName}')
    .addColumn('some_column', 'varchar(20)')
    .execute();

  await addUpdatedAtTrigger(db, '${migrationName}');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, '${migrationName}');
  await db.schema.dropTable('${migrationName}').execute();
}
`;

fs.writeFileSync(path.join(migrationsDir, filename), template);
console.log(`✓ Created migration: ${filename}`);
