import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, Selectable } from 'kysely';
import { createHash, randomBytes } from 'crypto';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';
import { RefreshTokenTable } from '../../database/tables/refresh-token.table';

export interface IssuedRefreshToken {
  /** The opaque token handed to the client — only its hash is stored. */
  token: string;
}

@Injectable()
export class RefreshTokensService {
  private readonly ttlDays: number;

  constructor(
    @Inject(DATABASE) private readonly db: Kysely<Database>,
    config: ConfigService,
  ) {
    this.ttlDays = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);

    await this.db
      .insertInto('refresh_tokens')
      .values({
        user_id: userId,
        token_hash: this.hash(token),
        expires_at: expiresAt.toISOString(),
      })
      .execute();

    return { token };
  }

  async findValid(
    token: string,
  ): Promise<Selectable<RefreshTokenTable> | undefined> {
    return this.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', this.hash(token))
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date().toISOString())
      .executeTakeFirst();
  }

  async revoke(id: string): Promise<void> {
    await this.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }
}
