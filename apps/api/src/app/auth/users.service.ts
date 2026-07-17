import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { AuthUser, UserRole } from '@arvid-l-monorepo-template/shared';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { UserTable } from '../../database/tables/user.table';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role?: UserRole;
  emailVerified?: boolean;
  privacyAccepted?: boolean;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async listAll(): Promise<AuthUser[]> {
    const rows = await this.db
      .selectFrom('users')
      .select(['id', 'email', 'role', 'display_name'])
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
    }));
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

  async create(input: CreateUserInput): Promise<Selectable<UserTable>> {
    return this.db
      .insertInto('users')
      .values({
        email: input.email,
        password_hash: input.passwordHash,
        display_name: input.displayName ?? null,
        role: input.role ?? UserRole.USER,
        // Scripted/bootstrap users skip the verification mail round-trip.
        email_verified_at: input.emailVerified
          ? new Date().toISOString()
          : null,
        // Consent timestamp — proof of WHEN the checkbox was accepted.
        privacy_accepted_at: input.privacyAccepted
          ? new Date().toISOString()
          : null,
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

  async updateDisplayName(
    id: string,
    displayName: string | null,
  ): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ display_name: displayName })
      .where('id', '=', id)
      .execute();
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ email })
      .where('id', '=', id)
      .execute();
  }

  // Account deletion is a hard DELETE on purpose: soft delete would keep
  // the email in the unique index (blocks re-registration) and survive a
  // GDPR erasure request. Tokens die via FK cascade.
  async deleteHard(id: string): Promise<void> {
    await this.db.deleteFrom('users').where('id', '=', id).execute();
  }
}
