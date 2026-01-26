import { Kysely, sql } from 'kysely';
import {
  addUpdatedAtTrigger,
  removeUpdatedAtTrigger,
  createTableWithBaseColumns,
  createEnum,
  dropEnum,
} from './helpers';
import { ExampleType } from '@arvid-l-monorepo-template/shared';

export async function up(db: Kysely<any>): Promise<void> {
  await createEnum(db, 'example_type', [
    ExampleType.TYPE_A,
    ExampleType.TYPE_B,
    ExampleType.TYPE_C,
  ]);

  await createTableWithBaseColumns(db, 'examples')
    .addColumn('name', 'varchar(255)')
    .addColumn('type', sql`example_type`, (col) => col.defaultTo('type_a'))
    .execute();

  await addUpdatedAtTrigger(db, 'examples');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'examples');
  await db.schema.dropTable('examples').ifExists().execute();
  await dropEnum(db, 'example_type');
}
