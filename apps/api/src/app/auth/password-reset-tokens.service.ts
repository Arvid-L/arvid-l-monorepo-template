import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { createHash, randomBytes } from 'crypto';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { PasswordResetTokenTable } from '../../database/tables/password-reset-token.table';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Same storage model as refresh tokens: the client gets an opaque random
// token, the DB only ever sees its sha256 hash — a leaked DB dump cannot be
// replayed as reset links.
@Injectable()
export class PasswordResetTokensService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(userId: string): Promise<string> {
    // Any previously issued (unused) tokens die with the new request —
    // only the latest reset mail works.
    await this.db
      .updateTable('password_reset_tokens')
      .set({ used_at: new Date().toISOString() })
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .execute();

    const token = randomBytes(48).toString('hex');
    await this.db
      .insertInto('password_reset_tokens')
      .values({
        user_id: userId,
        token_hash: this.hash(token),
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      })
      .execute();

    return token;
  }

  async findValid(
    token: string,
  ): Promise<Selectable<PasswordResetTokenTable> | undefined> {
    return this.db
      .selectFrom('password_reset_tokens')
      .selectAll()
      .where('token_hash', '=', this.hash(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date().toISOString())
      .executeTakeFirst();
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .updateTable('password_reset_tokens')
      .set({ used_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }
}
