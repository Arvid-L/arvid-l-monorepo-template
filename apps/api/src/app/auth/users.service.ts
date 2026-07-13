import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { UserTable } from '../../database/tables/user.table';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async findByEmail(email: string): Promise<Selectable<UserTable> | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }
}
