import { Inject, Injectable } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { createHash, randomBytes } from 'crypto';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { EmailVerificationTokenTable } from '../../database/tables/email-verification-token.table';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_REISSUE_INTERVAL_MS = 60 * 1000; // resend rate limit

// Same storage model as password reset tokens: the client gets an opaque
// random token, the DB only ever sees its sha256 hash.
@Injectable()
export class EmailVerificationTokensService {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Returns null when called again within the reissue interval — the
  // resend endpoint must stay silent (no enumeration), so no throw here.
  async issue(userId: string, newEmail?: string): Promise<string | null> {
    const recent = await this.db
      .selectFrom('email_verification_tokens')
      .select('id')
      .where('user_id', '=', userId)
      .where(
        'created_at',
        '>',
        new Date(Date.now() - MIN_REISSUE_INTERVAL_MS).toISOString(),
      )
      .executeTakeFirst();
    if (recent) {
      return null;
    }

    // Any previously issued (unused) tokens die with the new request.
    await this.db
      .updateTable('email_verification_tokens')
      .set({ used_at: new Date().toISOString() })
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .execute();

    const token = randomBytes(48).toString('hex');
    await this.db
      .insertInto('email_verification_tokens')
      .values({
        user_id: userId,
        token_hash: this.hash(token),
        // Set for email-CHANGE tokens; null for first-time verification.
        new_email: newEmail ?? null,
        expires_at: new Date(
          Date.now() + VERIFICATION_TOKEN_TTL_MS,
        ).toISOString(),
      })
      .execute();

    return token;
  }

  async findValid(
    token: string,
  ): Promise<Selectable<EmailVerificationTokenTable> | undefined> {
    return this.db
      .selectFrom('email_verification_tokens')
      .selectAll()
      .where('token_hash', '=', this.hash(token))
      .where('used_at', 'is', null)
      .where('expires_at', '>', new Date().toISOString())
      .executeTakeFirst();
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .updateTable('email_verification_tokens')
      .set({ used_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }
}
