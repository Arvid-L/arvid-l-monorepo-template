import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { AuthUser, UserRole } from '@arvid-l-monorepo-template/shared';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { UserTable } from '../../database/tables/user.table';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async listAll(): Promise<AuthUser[]> {
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'role'])
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'asc')
      .execute();
  }

  async findByEmail(email: string): Promise<Selectable<UserTable> | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async findById(id: string): Promise<Selectable<UserTable> | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  }

  async create(
    email: string,
    passwordHash: string,
    role: UserRole = UserRole.USER,
    emailVerified = false,
  ): Promise<Selectable<UserTable>> {
    return this.db
      .insertInto('users')
      .values({
        email,
        password_hash: passwordHash,
        role,
        // Scripted/bootstrap users skip the verification mail round-trip.
        email_verified_at: emailVerified ? new Date().toISOString() : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ email_verified_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ password_hash: passwordHash })
      .where('id', '=', id)
      .execute();
  }
}
