import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable, sql } from 'kysely';
import {
  AdminUser,
  PageRequest,
  PageResponse,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { UserTable } from '../../database/tables/user.table';
import {
  pageOffset,
  resolveSort,
  toPageResponse,
} from '../../common/pagination/pagination.util';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role?: UserRole;
  emailVerified?: boolean;
  privacyAccepted?: boolean;
}

const USER_SORT_COLUMNS: Record<string, string> = {
  email: 'email',
  role: 'role',
  createdAt: 'created_at',
};

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  private toAdminUser(user: Selectable<UserTable>): AdminUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      emailVerifiedAt: user.email_verified_at
        ? new Date(user.email_verified_at).toISOString()
        : null,
      disabledAt: user.disabled_at
        ? new Date(user.disabled_at).toISOString()
        : null,
      createdAt: new Date(user.created_at).toISOString(),
    };
  }

  async listPaged(query: PageRequest): Promise<PageResponse<AdminUser>> {
    const sortColumn = resolveSort(USER_SORT_COLUMNS, query.sort, 'created_at');
    // Newest first by default — fresh signups are what admins look for.
    const order = query.order ?? 'desc';

    const [rows, countRow] = await Promise.all([
      this.db
        .selectFrom('users')
        .selectAll()
        .where('deleted_at', 'is', null)
        .orderBy(sql.ref(sortColumn), order)
        .limit(query.pageSize)
        .offset(pageOffset(query))
        .execute(),
      this.db
        .selectFrom('users')
        .select(({ fn }) => fn.countAll<string>().as('total'))
        .where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow(),
    ]);

    return toPageResponse(
      rows.map((row) => this.toAdminUser(row)),
      Number(countRow.total),
      query,
    );
  }

  async updateRole(id: string, role: UserRole): Promise<AdminUser | undefined> {
    const user = await this.db
      .updateTable('users')
      .set({ role })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return user && this.toAdminUser(user);
  }

  async setDisabled(
    id: string,
    disabled: boolean,
  ): Promise<AdminUser | undefined> {
    const user = await this.db
      .updateTable('users')
      .set({ disabled_at: disabled ? new Date().toISOString() : null })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return user && this.toAdminUser(user);
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
