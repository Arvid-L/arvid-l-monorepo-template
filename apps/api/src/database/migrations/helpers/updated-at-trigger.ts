import { Kysely, sql } from 'kysely';

export async function addUpdatedAtTrigger(
  db: Kysely<any>,
  tableName: string,
): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON ${sql.table(tableName)}
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
  `.execute(db);
}

export async function removeUpdatedAtTrigger(
  db: Kysely<any>,
  tableName: string,
): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS set_updated_at ON ${sql.table(tableName)};
  `.execute(db);
}
