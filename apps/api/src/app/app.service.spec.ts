import { Test } from '@nestjs/testing';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { AppService } from './app.service';
import { DATABASE } from '../database/database.module';
import { Database } from '../database/database';

// Kysely instance that compiles queries but never touches a real database.
export function createTestDatabase(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: DATABASE, useValue: createTestDatabase() },
      ],
    }).compile();

    service = app.get<AppService>(AppService);
  });

  describe('healthCheck', () => {
    it('should report healthy when the database responds', async () => {
      await expect(service.healthCheck()).resolves.toEqual({
        message: 'Healthy',
      });
    });
  });
});
