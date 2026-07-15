import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // display_name: optional public name (fallback in UIs is the email).
  // disabled_at: admin kill switch — set = account cannot log in.
  // privacy_accepted_at: GDPR consent timestamp captured at registration;
  // existing users stay NULL (they predate the checkbox).
  await db.schema
    .alterTable('users')
    .addColumn('display_name', 'varchar(120)')
    .addColumn('disabled_at', 'timestamptz')
    .addColumn('privacy_accepted_at', 'timestamptz')
    .execute();

  // new_email: when set, the verification token confirms an email CHANGE
  // (link goes to the new address) instead of first-time verification.
  await db.schema
    .alterTable('email_verification_tokens')
    .addColumn('new_email', 'varchar(255)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('email_verification_tokens')
    .dropColumn('new_email')
    .execute();
  await db.schema
    .alterTable('users')
    .dropColumn('privacy_accepted_at')
    .dropColumn('disabled_at')
    .dropColumn('display_name')
    .execute();
}
