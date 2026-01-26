import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { Database } from './database';

export const DATABASE = 'DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Kysely<Database> => {
        const dialect = new PostgresDialect({
          pool: new Pool({
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            max: 10,
          }),
        });

        return new Kysely<Database>({ dialect });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
