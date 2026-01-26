import { Kysely, sql } from 'kysely';

export async function createEnum(
  db: Kysely<any>,
  enumName: string,
  values: string[],
): Promise<void> {
  const valuesList = values.map((v) => `'${v}'`).join(', ');
  await sql`CREATE TYPE ${sql.raw(enumName)} AS ENUM (${sql.raw(valuesList)})`.execute(
    db,
  );
}

export async function dropEnum(
  db: Kysely<any>,
  enumName: string,
): Promise<void> {
  await sql`DROP TYPE IF EXISTS ${sql.raw(enumName)}`.execute(db);
}

export async function addEnumValue(
  db: Kysely<any>,
  enumName: string,
  newValue: string,
  before?: string,
  after?: string,
): Promise<void> {
  let query = `ALTER TYPE ${enumName} ADD VALUE '${newValue}'`;

  if (before) {
    query += ` BEFORE '${before}'`;
  } else if (after) {
    query += ` AFTER '${after}'`;
  }

  await sql.raw(query).execute(db);
}

export async function renameEnum(
  db: Kysely<any>,
  oldName: string,
  newName: string,
): Promise<void> {
  await sql`ALTER TYPE ${sql.raw(oldName)} RENAME TO ${sql.raw(newName)}`.execute(
    db,
  );
}

export async function enumExists(
  db: Kysely<any>,
  enumName: string,
): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type
      WHERE typname = ${enumName}
    )
  `.execute(db);

  return result.rows[0]?.exists ?? false;
}
