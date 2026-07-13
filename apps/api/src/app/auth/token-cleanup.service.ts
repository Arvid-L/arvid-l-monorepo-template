import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Kysely } from 'kysely';
import { DATABASE } from '../../database/database.module';
import { Database } from '../../database/database';

// Housekeeping: expired/revoked tokens are dead weight — nothing reads them
// after their cutoff, they only grow the tables. Doubles as the pattern to
// copy for any scheduled job (@nestjs/schedule is wired in app.module).
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeStaleTokens(): Promise<void> {
    const now = new Date().toISOString();

    const refresh = await this.db
      .deleteFrom('refresh_tokens')
      .where((eb) =>
        eb.or([eb('expires_at', '<', now), eb('revoked_at', 'is not', null)]),
      )
      .executeTakeFirst();

    const reset = await this.db
      .deleteFrom('password_reset_tokens')
      .where((eb) =>
        eb.or([eb('expires_at', '<', now), eb('used_at', 'is not', null)]),
      )
      .executeTakeFirst();

    this.logger.log(
      `Purged ${refresh.numDeletedRows} stale refresh tokens, ` +
        `${reset.numDeletedRows} stale password reset tokens`,
    );
  }
}
