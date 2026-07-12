import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { DATABASE } from '../database/database.module';
import { Database } from '../database/database';

@Injectable()
export class AppService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async healthCheck(): Promise<{ message: string }> {
    try {
      await sql`select 1`.execute(this.db);
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }

    return { message: 'Healthy' };
  }
}
