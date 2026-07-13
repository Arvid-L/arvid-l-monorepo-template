# Hetzner Mail + Registration Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registration email verification with a hard login gate, plus documented Hetzner-webhosting SMTP setup and a mail smoke-test script, so projects branched from this template have working mail from day one.

**Architecture:** Mirror the existing password-reset token pattern exactly (opaque token → sha256 hash at rest → TTL → invalidate-on-reissue). New `email_verification_tokens` table + service, `users.email_verified_at` column (existing rows backfilled as verified), register stops auto-logging-in, login rejects unverified users with a distinct error code, verify endpoint returns a full `LoginResponse`.

**Tech Stack:** NestJS 11, Kysely + Postgres 16, Angular 21 (standalone components, signals), Jest, Cypress, nodemailer.

**Spec:** `docs/superpowers/specs/2026-07-13-hetzner-mail-and-email-verification-design.md`

## Global Constraints

- Shared import alias: `@arvid-l-monorepo-template/shared` (never a relative path across libs).
- Migrations: static map in `apps/api/src/database/migrations/_all-migrations.ts`; migrations run on API boot. Never rename existing migration keys.
- Every commit runs lint-staged (prettier + eslint) via husky — write clean code, the hook will reformat markdown/ts.
- Verification token TTL: **24 h**. Minimum **60 s** between token issues per user. Reset-token semantics for everything else.
- Error code for the login gate: `EMAIL_NOT_VERIFIED`, HTTP **403** (bad credentials stay 401).
- Verify link format: `${APP_BASE_URL}/verify-email?token=<raw token>` (fallback `http://localhost:4200`).
- No user enumeration: resend endpoint always returns 204.
- Commit after every task, conventional-commit style, imperative subject.
- Run all commands from the repo root (`~/dev/arvid-l-monorepo-template`).
- `docker compose up -d` must be running for e2e (dev DB :5432, e2e DB :5433).

---

### Task 1: Shared lib — types and error code

**Files:**

- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Modify: `libs/shared/src/lib/enums/error-code.enum.ts`

**Interfaces:**

- Produces: `RegisterResponse { message: string }`, `VerifyEmailDto { token: string }`, `ResendVerificationDto { email: string }`, `ErrorCode.EMAIL_NOT_VERIFIED` — consumed by every later task.

- [x] **Step 1: Add the new types**

Append to `libs/shared/src/lib/models/auth.model.ts`:

```typescript
export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

// register() no longer returns tokens — the account must be verified first.
export interface RegisterResponse {
  message: string;
}
```

Add to the enum in `libs/shared/src/lib/enums/error-code.enum.ts` (after `FORBIDDEN`):

```typescript
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
```

- [x] **Step 2: Verify the lib builds**

Run: `npx nx build shared && npx nx lint shared`
Expected: both succeed.

- [x] **Step 3: Commit**

```bash
git add libs/shared
git commit -m "feat(shared): types for email verification flow"
```

---

### Task 2: DB — migration 006, table type, Database registration

**Files:**

- Create: `apps/api/src/database/migrations/006_add_email_verification.ts`
- Create: `apps/api/src/database/tables/email-verification-token.table.ts`
- Modify: `apps/api/src/database/migrations/_all-migrations.ts`
- Modify: `apps/api/src/database/tables/user.table.ts`
- Modify: `apps/api/src/database/database.ts`

**Interfaces:**

- Produces: `email_verification_tokens` table in `Database`, `UserTable.email_verified_at: string | Date | null`.

- [x] **Step 1: Write the migration**

`apps/api/src/database/migrations/006_add_email_verification.ts` (model: `005_create_password_reset_tokens_table.ts`):

```typescript
import { Kysely, sql } from 'kysely';
import { addUpdatedAtTrigger, removeUpdatedAtTrigger, createTableWithBaseColumns } from './helpers';

export async function up(db: Kysely<any>): Promise<void> {
  // Existing users are backfilled as verified — running deployments must
  // not lock their users out when this migration lands.
  await db.schema.alterTable('users').addColumn('email_verified_at', 'timestamptz').execute();
  await db
    .updateTable('users')
    .set({ email_verified_at: sql`now()` })
    .execute();

  await createTableWithBaseColumns(db, 'email_verification_tokens')
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token_hash', 'varchar(128)', (col) => col.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('used_at', 'timestamptz')
    .execute();

  await db.schema.createIndex('email_verification_tokens_user_id_idx').on('email_verification_tokens').column('user_id').execute();

  await addUpdatedAtTrigger(db, 'email_verification_tokens');
}

export async function down(db: Kysely<any>): Promise<void> {
  await removeUpdatedAtTrigger(db, 'email_verification_tokens');
  await db.schema.dropTable('email_verification_tokens').ifExists().execute();
  await db.schema.alterTable('users').dropColumn('email_verified_at').execute();
}
```

- [x] **Step 2: Register the migration**

In `apps/api/src/database/migrations/_all-migrations.ts` add the import and map entry:

```typescript
import * as migration_006_email_verification from './006_add_email_verification';
```

```typescript
  migration_006_email_verification,
```

- [x] **Step 3: Table types**

Create `apps/api/src/database/tables/email-verification-token.table.ts`:

```typescript
import { BaseTable } from './templates/base.table';

export interface EmailVerificationTokenTable extends BaseTable {
  user_id: string;
  token_hash: string;
  expires_at: string | Date;
  used_at: string | Date | null;
}
```

In `apps/api/src/database/tables/user.table.ts` add to `UserTable`:

```typescript
email_verified_at: string | Date | null;
```

In `apps/api/src/database/database.ts` import the new table and add to `Database` (alphabetical position):

```typescript
import { EmailVerificationTokenTable } from './tables/email-verification-token.table';
```

```typescript
email_verification_tokens: EmailVerificationTokenTable;
```

- [x] **Step 4: Run the API tests + boot check**

Run: `npx nx test api`
Expected: existing suites pass (nothing consumes the new column yet — failures here mean a typo in the types).

Run: `docker compose up -d && npx nx serve api` briefly (Ctrl-C after boot logs).
Expected log line: migration `migration_006_email_verification` executed, no errors.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/database
git commit -m "feat(api): email_verified_at column + email_verification_tokens table"
```

---

### Task 3: API — EmailVerificationTokensService

**Files:**

- Create: `apps/api/src/app/auth/email-verification-tokens.service.ts`
- Modify: `apps/api/src/app/auth/auth.module.ts`

**Interfaces:**

- Consumes: `Database` with `email_verification_tokens` (Task 2).
- Produces: `EmailVerificationTokensService.issue(userId: string): Promise<string | null>` (null = rate-limited), `findValid(token: string)`, `markUsed(id: string)`.

- [x] **Step 1: Write the service** (clone of `password-reset-tokens.service.ts`, two deltas: 24 h TTL, 60 s reissue guard)

```typescript
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
  async issue(userId: string): Promise<string | null> {
    const recent = await this.db
      .selectFrom('email_verification_tokens')
      .select('id')
      .where('user_id', '=', userId)
      .where('created_at', '>', new Date(Date.now() - MIN_REISSUE_INTERVAL_MS).toISOString())
      .executeTakeFirst();
    if (recent) {
      return null;
    }

    // Any previously issued (unused) tokens die with the new request.
    await this.db.updateTable('email_verification_tokens').set({ used_at: new Date().toISOString() }).where('user_id', '=', userId).where('used_at', 'is', null).execute();

    const token = randomBytes(48).toString('hex');
    await this.db
      .insertInto('email_verification_tokens')
      .values({
        user_id: userId,
        token_hash: this.hash(token),
        expires_at: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString(),
      })
      .execute();

    return token;
  }

  async findValid(token: string): Promise<Selectable<EmailVerificationTokenTable> | undefined> {
    return this.db.selectFrom('email_verification_tokens').selectAll().where('token_hash', '=', this.hash(token)).where('used_at', 'is', null).where('expires_at', '>', new Date().toISOString()).executeTakeFirst();
  }

  async markUsed(id: string): Promise<void> {
    await this.db.updateTable('email_verification_tokens').set({ used_at: new Date().toISOString() }).where('id', '=', id).execute();
  }
}
```

- [x] **Step 2: Register in `auth.module.ts`**

Add `EmailVerificationTokensService` to the imports at top and to the `providers` array (next to `PasswordResetTokensService`).

- [x] **Step 3: Lint + build**

Run: `npx nx lint api && npx nx build api`
Expected: green. (Unit coverage for this service comes through `auth.service.spec.ts` in Task 5, matching how `PasswordResetTokensService` is covered.)

- [x] **Step 4: Commit**

```bash
git add apps/api/src/app/auth
git commit -m "feat(api): email verification token service"
```

---

### Task 4: API — UsersService verified support

**Files:**

- Modify: `apps/api/src/app/auth/users.service.ts`

**Interfaces:**

- Produces: `create(email, passwordHash, role?, emailVerified = false)`, `markEmailVerified(id: string): Promise<void>`.

- [x] **Step 1: Extend `create()` and add `markEmailVerified()`**

Replace the existing `create` and append the new method:

```typescript
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
```

- [x] **Step 2: Lint + test**

Run: `npx nx lint api && npx nx test api`
Expected: green.

- [x] **Step 3: Commit**

```bash
git add apps/api/src/app/auth/users.service.ts
git commit -m "feat(api): users service supports pre-verified accounts"
```

---

### Task 5: API — auth flow (register gate, login gate, verify, resend)

**Files:**

- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Create: `apps/api/src/app/auth/dto/verify-email.dto.ts`
- Create: `apps/api/src/app/auth/dto/resend-verification.dto.ts`
- Test: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: `EmailVerificationTokensService` (Task 3), `UsersService.markEmailVerified` (Task 4), shared types (Task 1).
- Produces: `POST /auth/verify-email {token} → LoginResponse`, `POST /auth/resend-verification {email} → 204`, changed `POST /auth/register → RegisterResponse`, `login()` throws `ForbiddenException` with `code: EMAIL_NOT_VERIFIED`.

- [x] **Step 1: Write the failing tests**

In `auth.service.spec.ts`: add mocks for the new service next to the existing reset mocks —

```typescript
const issueVerification = jest.fn();
const findValidVerification = jest.fn();
const markUsedVerification = jest.fn();
const markEmailVerified = jest.fn();
```

Register the provider in the testing module (next to `PasswordResetTokensService`):

```typescript
        {
          provide: EmailVerificationTokensService,
          useValue: {
            issue: issueVerification,
            findValid: findValidVerification,
            markUsed: markUsedVerification,
          },
        },
```

Add `markEmailVerified` to the `UsersService` mock object. Give `storedUser` an
`email_verified_at: new Date().toISOString()` field. Then the new cases:

```typescript
describe('register', () => {
  it('creates the user unverified, sends a verification mail, returns no tokens', async () => {
    create.mockResolvedValue({ ...storedUser, email_verified_at: null });
    issueVerification.mockResolvedValue('raw-verification-token');
    sendMail.mockResolvedValue(undefined);

    const result = await service.register('new@example.org', 'password-123');

    expect(result).toEqual({ message: expect.any(String) });
    expect(issueVerification).toHaveBeenCalledWith(storedUser.id);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: storedUser.email,
        subject: expect.stringContaining('Verify'),
        text: expect.stringContaining('/verify-email?token=raw-verification-token'),
      }),
    );
    expect(issue).not.toHaveBeenCalled(); // no refresh token pair
  });
});

describe('login gate', () => {
  it('rejects unverified users with EMAIL_NOT_VERIFIED', async () => {
    findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });

    await expect(service.login('admin@example.org', 'secret-password')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
    });
  });
});

describe('verifyEmail', () => {
  it('marks user verified, consumes the token, returns a login response', async () => {
    findValidVerification.mockResolvedValue({
      id: 'evt-1',
      user_id: storedUser.id,
    });
    findById.mockResolvedValue(storedUser);

    const result = await service.verifyEmail('raw-token');

    expect(markEmailVerified).toHaveBeenCalledWith(storedUser.id);
    expect(markUsedVerification).toHaveBeenCalledWith('evt-1');
    expect(result.user.email).toBe(storedUser.email);
    expect(result.accessToken).toBeDefined();
  });

  it('rejects an invalid token', async () => {
    findValidVerification.mockResolvedValue(undefined);
    await expect(service.verifyEmail('bad')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('resendVerification', () => {
  it('resolves silently for unknown emails', async () => {
    findByEmail.mockResolvedValue(undefined);
    await expect(service.resendVerification('ghost@example.org')).resolves.toBeUndefined();
    expect(issueVerification).not.toHaveBeenCalled();
  });

  it('resolves silently for already-verified users', async () => {
    findByEmail.mockResolvedValue(storedUser); // has email_verified_at
    await service.resendVerification(storedUser.email);
    expect(issueVerification).not.toHaveBeenCalled();
  });

  it('reissues and mails for unverified users', async () => {
    findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });
    issueVerification.mockResolvedValue('fresh-token');
    sendMail.mockResolvedValue(undefined);

    await service.resendVerification(storedUser.email);

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: storedUser.email }));
  });

  it('skips the mail when rate-limited (issue returns null)', async () => {
    findByEmail.mockResolvedValue({ ...storedUser, email_verified_at: null });
    issueVerification.mockResolvedValue(null);

    await service.resendVerification(storedUser.email);

    expect(sendMail).not.toHaveBeenCalled();
  });
});
```

Also update the existing register test (it currently expects a token pair) to the new no-tokens contract.

- [x] **Step 2: Run tests to verify they fail**

Run: `npx nx test api --testPathPattern=auth.service`
Expected: FAIL — `verifyEmail`/`resendVerification` don't exist, register still returns tokens.

- [x] **Step 3: Implement `auth.service.ts` changes**

Imports: add `ForbiddenException` to the `@nestjs/common` import, `ErrorCode` and `RegisterResponse` to the shared import, and:

```typescript
import { EmailVerificationTokensService } from './email-verification-tokens.service';
```

Constructor: add `private readonly emailVerificationTokensService: EmailVerificationTokensService,`.

In `login()`, after the credential check and before `issueTokenPair`:

```typescript
// Hard gate: unverified accounts cannot log in. Distinct code so the FE
// can offer "resend verification mail" instead of a generic error.
if (!user.email_verified_at) {
  throw new ForbiddenException({
    statusCode: 403,
    code: ErrorCode.EMAIL_NOT_VERIFIED,
    message: 'Please verify your email address first',
  });
}
```

Replace `register()`:

```typescript
  // Open registration — every new account gets the USER role and starts
  // unverified: no tokens until the mailed link is clicked (hard gate).
  async register(email: string, password: string): Promise<RegisterResponse> {
    try {
      const user = await this.usersService.create(
        email,
        hashPassword(password),
      );
      await this.sendVerificationMail(user.id, user.email);
      return { message: 'Check your inbox to verify your email address' };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<LoginResponse> {
    const stored = await this.emailVerificationTokensService.findValid(token);
    if (!stored) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const user = await this.usersService.findById(stored.user_id);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.markEmailVerified(user.id);
    await this.emailVerificationTokensService.markUsed(stored.id);

    // Clicking the mail link logs the user straight in.
    return this.issueTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // Same no-enumeration contract as forgotPassword: always resolves.
  async resendVerification(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.email_verified_at) {
      return;
    }
    await this.sendVerificationMail(user.id, user.email);
  }

  private async sendVerificationMail(
    userId: string,
    email: string,
  ): Promise<void> {
    // null = reissued too soon (rate limit) — stay silent.
    const token = await this.emailVerificationTokensService.issue(userId);
    if (!token) {
      return;
    }

    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4200';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    // Not awaited by callers that must not leak timing; here register/resend
    // both await issue() but fire the SMTP call without blocking failures.
    await this.mailService
      .send({
        to: email,
        subject: 'Verify your email address',
        text:
          `Welcome! Confirm this email address to activate your account.\n\n` +
          `Verify your email (link valid for 24 hours):\n${verifyUrl}\n\n` +
          `If you didn't create this account, ignore this mail.`,
      })
      .catch((error) =>
        this.logger.error(`Verification mail to ${email} failed`, error),
      );
  }
```

- [x] **Step 4: DTOs**

`apps/api/src/app/auth/dto/verify-email.dto.ts`:

```typescript
import { VerifyEmailDto as SharedVerifyEmailDto } from '@arvid-l-monorepo-template/shared';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto implements SharedVerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
```

`apps/api/src/app/auth/dto/resend-verification.dto.ts`:

```typescript
import { ResendVerificationDto as SharedResendVerificationDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto implements SharedResendVerificationDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}
```

- [x] **Step 5: Controller endpoints**

In `auth.controller.ts`: add `RegisterResponse` to the shared import, import both new DTOs, change `register()`'s return type to `Promise<RegisterResponse>`, and add after `resetPassword`:

```typescript
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIAL_THROTTLE)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<LoginResponse> {
    return this.authService.verifyEmail(dto.token);
  }

  // Always 204, whether or not the email exists (no account enumeration).
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(CREDENTIAL_THROTTLE)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    await this.authService.resendVerification(dto.email);
  }
```

- [x] **Step 6: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS, including the updated register contract.

- [x] **Step 7: Commit**

```bash
git add apps/api/src/app/auth libs/shared
git commit -m "feat(api): email verification — register gate, verify + resend endpoints"
```

---

### Task 6: API — token cleanup sweeps verification tokens

**Files:**

- Modify: `apps/api/src/app/auth/token-cleanup.service.ts`
- Test: `apps/api/src/app/auth/token-cleanup.service.spec.ts`

- [x] **Step 1: Extend the spec** — mirror the existing expectations: the spec asserts deletes on `refresh_tokens` and `password_reset_tokens`; add the same assertion pattern for `email_verification_tokens`.

- [x] **Step 2: Run to verify it fails**

Run: `npx nx test api --testPathPattern=token-cleanup`
Expected: FAIL.

- [x] **Step 3: Implement** — in `purgeStaleTokens()` add after the `reset` block:

```typescript
const verification = await this.db
  .deleteFrom('email_verification_tokens')
  .where((eb) => eb.or([eb('expires_at', '<', now), eb('used_at', 'is not', null)]))
  .executeTakeFirst();
```

and extend the log line:

```typescript
this.logger.log(`Purged ${refresh.numDeletedRows} stale refresh tokens, ` + `${reset.numDeletedRows} stale password reset tokens, ` + `${verification.numDeletedRows} stale email verification tokens`);
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx nx test api --testPathPattern=token-cleanup`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/api/src/app/auth/token-cleanup.service.ts apps/api/src/app/auth/token-cleanup.service.spec.ts
git commit -m "feat(api): purge stale email verification tokens"
```

---

### Task 7: create-user script creates verified users

**Files:**

- Modify: `tools/scripts/create-user.ts`

- [x] **Step 1: Add `email_verified_at`** — the script's insert `values({...})` gains `email_verified_at: new Date().toISOString(),` and the `doUpdateSet({...})` gains the same line (bootstrap/admin path must never end up gated). Update the script's inline type from `{ email: string; password_hash: string; role: string }` to include `email_verified_at: string`.

- [x] **Step 2: Verify against the dev DB**

Run: `docker compose up -d && npm run user:create -- script-test@example.org test-password-123`
Expected: `✓ User script-test@example.org created/updated`.
Then: `docker compose exec -T postgres psql -U postgres -d arvid-l-monorepo-template-db -c "select email, email_verified_at from users where email='script-test@example.org'"`
Expected: non-null `email_verified_at`. (Check the container/db/user names in `docker-compose.yml` if psql refuses.)

- [x] **Step 3: Commit**

```bash
git add tools/scripts/create-user.ts
git commit -m "feat(tools): create-user marks accounts verified"
```

---

### Task 8: FE — api service, auth service, register inbox state

**Files:**

- Modify: `apps/frontend/src/app/core/auth/auth.api.service.ts`
- Modify: `apps/frontend/src/app/core/auth/auth.service.ts`
- Modify: `apps/frontend/src/app/components/auth/register/register.component.ts`
- Modify: `apps/frontend/src/app/components/auth/register/register.component.html`
- Test: colocated `.spec.ts` files if present for these units (follow existing FE spec pattern; at minimum the register component spec below).

**Interfaces:**

- Consumes: shared `RegisterResponse`, `VerifyEmailDto`, `ResendVerificationDto` (Task 1); API endpoints (Task 5).
- Produces: `AuthApiService.verifyEmail(token): Observable<LoginResponse>` (stores tokens), `AuthApiService.resendVerification(email): Observable<void>`, `AuthService.register(): Observable<RegisterResponse>` (no state change), `AuthService.verifyEmail(token)` (sets currentUser). Task 9/10 call these.

- [x] **Step 1: `auth.api.service.ts`** — add `RegisterResponse` to the shared import; register no longer stores tokens:

```typescript
  register(data: RegisterDto): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, data);
  }

  verifyEmail(token: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/verify-email`, { token })
      .pipe(tap((response) => this.storeTokens(response)));
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/resend-verification`, {
      email,
    });
  }
```

- [x] **Step 2: `auth.service.ts` (FE)** — register no longer logs in; verify does:

```typescript
  // Registration no longer returns a session — the user must click the
  // verification link first (hard gate, see API AuthService.register).
  register(data: RegisterDto): Observable<RegisterResponse> {
    return this.authApi.register(data);
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.authApi
      .verifyEmail(token)
      .pipe(tap((response) => this.currentUser.set(response.user)));
  }
```

(`RegisterResponse` joins the shared import.)

- [x] **Step 3: Register component — inbox state**

`register.component.ts`: add signals + resend handling, stop navigating on success:

```typescript
  readonly registered = signal(false);
  readonly resendCooldown = signal(false);
  readonly submittedEmail = signal('');
```

`onSubmit()` success branch becomes:

```typescript
this.auth.register({ email, password }).subscribe({
  next: () => {
    this.submittedEmail.set(email);
    this.registered.set(true);
  },
  // errors surface via the global httpErrorInterceptor toast
  error: () => this.submitting.set(false),
});
```

Add (inject `AuthApiService` as `authApi` alongside the existing injects):

```typescript
  resend(): void {
    this.resendCooldown.set(true);
    this.authApi.resendVerification(this.submittedEmail()).subscribe();
    // Matches the API's 60 s reissue limit — button wakes up when a new
    // token could actually be issued.
    setTimeout(() => this.resendCooldown.set(false), 60_000);
  }
```

`register.component.html`: wrap the existing card content in `@if (!registered()) { ... } @else { ... }` where the else branch is:

```html
<h1>Check your inbox</h1>
<p>We sent a verification link to <strong>{{ submittedEmail() }}</strong>. Click it to activate your account.</p>
<button mat-stroked-button type="button" [disabled]="resendCooldown()" (click)="resend()">Resend mail</button>
```

(Keep the surrounding `mat-card` structure — only the inner content branches.)

- [x] **Step 4: FE tests**

Follow the existing FE spec pattern (look at a neighboring component spec for TestBed setup). Cover: submit → `registered()` true and no navigation; `resend()` → `resendVerification` called and cooldown set.

Run: `npx nx test frontend`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/frontend/src/app
git commit -m "feat(frontend): register flow ends in check-your-inbox state"
```

---

### Task 9: FE — verify-email page + route

**Files:**

- Create: `apps/frontend/src/app/components/auth/verify-email/verify-email.component.ts`
- Create: `apps/frontend/src/app/components/auth/verify-email/verify-email.component.html`
- Modify: `apps/frontend/src/app/components/auth/index.ts`
- Modify: `apps/frontend/src/app/core/constants/routes.constants.ts`
- Modify: `apps/frontend/src/app/app.routes.ts`

**Interfaces:**

- Consumes: `AuthService.verifyEmail` (Task 8), `AuthApiService.resendVerification` (Task 8).

- [x] **Step 1: Route constant** — in `routes.constants.ts`:

```typescript
  // Keep in sync with the link in the API's verification mail
  // (AuthService.sendVerificationMail: APP_BASE_URL/verify-email?token=...)
  VERIFY_EMAIL: 'verify-email',
```

- [x] **Step 2: Component** (`verify-email.component.ts`) — model: `reset-password.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../core/auth/auth.api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ROUTES } from '../../../core/constants/routes.constants';

// Landing page for the link in the verification mail:
// /verify-email?token=<opaque token>
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../auth-page.scss'],
})
export class VerifyEmailComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ROUTES = ROUTES;
  readonly status = signal<'verifying' | 'error'>('verifying');
  readonly resendRequested = signal(false);

  // For the error state: let the user request a fresh link.
  resendForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('error');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.toast.success('Email verified — welcome!');
        this.router.navigate(['/']);
      },
      // errors also surface via the global httpErrorInterceptor toast
      error: () => this.status.set('error'),
    });
  }

  resend(): void {
    if (!this.resendForm.valid) {
      return;
    }
    this.authApi.resendVerification(this.resendForm.value.email).subscribe(() => this.resendRequested.set(true));
  }
}
```

- [x] **Step 3: Template** (`verify-email.component.html`) — match the card markup of `reset-password.component.html` (copy its shell):

```html
<div class="auth-page">
  <mat-card>
    <mat-card-content>
      @if (status() === 'verifying') {
      <h1>Verifying…</h1>
      <p>Checking your verification link.</p>
      } @else {
      <h1>Link invalid or expired</h1>
      @if (!resendRequested()) {
      <p>Request a fresh verification mail:</p>
      <form [formGroup]="resendForm" (ngSubmit)="resend()">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <button mat-flat-button color="primary" type="submit">Resend verification mail</button>
      </form>
      } @else {
      <p>If that address has an unverified account, a mail is on its way.</p>
      }
      <a mat-button [routerLink]="['/', ROUTES.LOGIN]">Back to login</a>
      }
    </mat-card-content>
  </mat-card>
</div>
```

(Adjust the wrapper classes to exactly match `reset-password.component.html` — copy its outer structure.)

- [x] **Step 4: Wire up** — export from `components/auth/index.ts`, add route in `app.routes.ts`:

```typescript
  {
    path: ROUTES.VERIFY_EMAIL,
    component: VerifyEmailComponent,
  },
```

(Route stays public — must be reachable logged-out.)

- [x] **Step 5: Test + lint**

Run: `npx nx test frontend && npx nx lint frontend`
Expected: PASS. Add a component spec covering: valid token → navigate to `/`; missing/invalid token → error state; resend → `resendVerification` called (mirror the register spec's TestBed setup from Task 8).

- [x] **Step 6: Commit**

```bash
git add apps/frontend/src/app
git commit -m "feat(frontend): verify-email landing page"
```

---

### Task 10: FE — login page unverified branch

**Files:**

- Modify: `apps/frontend/src/app/components/auth/login/login.component.ts`
- Modify: `apps/frontend/src/app/components/auth/login/login.component.html`

**Interfaces:**

- Consumes: `ErrorCode.EMAIL_NOT_VERIFIED` (shared), `AuthApiService.resendVerification` (Task 8). API sends `{ code: 'EMAIL_NOT_VERIFIED' }` in the 403 body (Task 5).

- [x] **Step 1: Component logic**

Imports: `HttpErrorResponse` from `@angular/common/http`, `ErrorCode` from the shared lib, inject `AuthApiService` as `authApi`. Add signals:

```typescript
  readonly unverifiedEmail = signal<string | null>(null);
  readonly resendRequested = signal(false);
```

Error branch in `onSubmit()`:

```typescript
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        // 403 EMAIL_NOT_VERIFIED gets its own UI (resend link) instead of
        // only the generic toast from httpErrorInterceptor.
        this.unverifiedEmail.set(
          err.error?.code === ErrorCode.EMAIL_NOT_VERIFIED
            ? this.form.value.email
            : null,
        );
      },
```

Add:

```typescript
  resendVerification(): void {
    const email = this.unverifiedEmail();
    if (!email) {
      return;
    }
    this.authApi
      .resendVerification(email)
      .subscribe(() => this.resendRequested.set(true));
  }
```

- [x] **Step 2: Template** — inside the card, after the form:

```html
@if (unverifiedEmail()) {
<p class="unverified-hint">
  This account's email address is not verified yet. @if (!resendRequested()) {
  <button mat-button type="button" (click)="resendVerification()">Resend verification mail</button>
  } @else { A new mail is on its way — check your inbox. }
</p>
}
```

- [x] **Step 3: Test + lint**

Run: `npx nx test frontend && npx nx lint frontend`
Expected: PASS. Spec cases: 403 with code `EMAIL_NOT_VERIFIED` → `unverifiedEmail()` set; 401 → stays null.

- [x] **Step 4: Commit**

```bash
git add apps/frontend/src/app/components/auth/login
git commit -m "feat(frontend): resend option on unverified login"
```

---

### Task 11: E2E — adapt auth flow tests

**Files:**

- Modify: `apps/frontend-e2e/src/e2e/auth.cy.ts`

The old happy path (register → logged in) is gone by design. New coverage:

- [x] **Step 1: Rewrite `auth.cy.ts`**

```typescript
describe('auth flow', () => {
  const password = 'e2e-password-123';

  // Creates a verified user directly in the e2e DB (create-user.ts marks
  // accounts verified) — the only way to get past the hard gate without
  // clicking a mail link. Credentials from .env.e2e.
  const createVerifiedUser = (email: string) => cy.exec(`DATABASE_HOST=localhost DATABASE_PORT=5433 ` + `DATABASE_NAME=arvid-l-monorepo-template-db-test ` + `DATABASE_USER=postgres DATABASE_PASSWORD=password ` + `npx tsx tools/scripts/create-user.ts ${email} ${password}`);

  it('registration ends on the check-your-inbox screen, not logged in', () => {
    const email = `e2e-user-${Date.now()}@example.org`;
    cy.visit('/register');

    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.contains('button', 'Create account').click();

    cy.contains('Check your inbox').should('be.visible');
    cy.contains('button', 'Resend mail').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('unverified login is rejected with a resend option', () => {
    const email = `e2e-unverified-${Date.now()}@example.org`;
    cy.visit('/register');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.get('input[formcontrolname="passwordConfirm"]').type(password);
    cy.contains('button', 'Create account').click();
    cy.contains('Check your inbox').should('be.visible');

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();

    cy.contains('button', 'Resend verification mail').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('a verified user can log in, out, and back in', () => {
    const email = `e2e-verified-${Date.now()}@example.org`;
    createVerifiedUser(email);

    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', email).should('be.visible');

    cy.contains('button', 'Logout').click();
    cy.contains('button', 'Logout').should('not.exist');

    cy.get('input[formcontrolname="email"]').type(email);
    cy.get('input[formcontrolname="password"]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', email).should('be.visible');
  });

  it('rejects a wrong password with an error toast', () => {
    cy.visit('/login');
    cy.get('input[formcontrolname="email"]').type('nobody@example.org');
    cy.get('input[formcontrolname="password"]').type('wrong-password');
    cy.contains('button', 'Login').click();

    cy.get('simple-snack-bar').should('be.visible');
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('shows the error state for a garbage verification token', () => {
    cy.visit('/verify-email?token=garbage');
    cy.contains('Link invalid or expired').should('be.visible');
    cy.contains('button', 'Resend verification mail').should('be.visible');
  });
});
```

- [x] **Step 2: Run e2e**

Run: `docker compose up -d && npx nx e2e frontend-e2e`
Expected: PASS. (The e2e target boots API + FE against the :5433 test DB — check `apps/frontend-e2e/project.json` if the wiring looks different and adapt the `createVerifiedUser` env values to `.env.e2e`.)

- [x] **Step 3: Commit**

```bash
git add apps/frontend-e2e
git commit -m "test(e2e): auth flow with email verification gate"
```

---

### Task 12: Docs, env example, mail smoke-test script

**Files:**

- Create: `tools/scripts/send-test-mail.ts`
- Modify: `package.json` (scripts)
- Modify: `.env.production.example`
- Modify: `docs/NEW-PROJECT.md`
- Modify: `docs/HETZNER-SETUP.md`

- [x] **Step 1: Smoke-test script** (`tools/scripts/send-test-mail.ts`):

```typescript
import { createTransport } from 'nodemailer';
import { config } from 'dotenv';
import { resolve } from 'path';

// Sends one test mail through the configured SMTP settings.
// Usage: npm run mail:test -- you@somewhere.com
// Reads SMTP_* / MAIL_FROM from the environment; falls back to
// .env.production (never committed) so it works from a fresh checkout.
if (!process.env.SMTP_HOST) {
  config({ path: resolve(__dirname, '../../.env.production') });
}

const to = process.argv[2];
if (!to) {
  console.error('Usage: npm run mail:test -- <recipient>');
  process.exit(1);
}
if (!process.env.SMTP_HOST) {
  console.error('SMTP_HOST not set (env or .env.production) — nothing to test.');
  process.exit(1);
}

const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

transporter
  .sendMail({
    from: process.env.MAIL_FROM ?? 'noreply@localhost',
    to,
    subject: 'SMTP test mail',
    text: `SMTP settings work. Sent via ${process.env.SMTP_HOST}.`,
  })
  .then((info) => {
    console.log(`✓ Test mail sent to ${to} (${info.messageId})`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Sending failed:', error.message);
    process.exit(1);
  });
```

Add to `package.json` scripts (after `user:create`):

```json
    "mail:test": "tsx tools/scripts/send-test-mail.ts",
```

- [x] **Step 2: `.env.production.example`** — replace the SMTP block's comment header with the Hetzner-flavored version (keep all variable names):

```dotenv
# Outgoing mail (verification, password reset). All optional: without
# SMTP_HOST mails are only logged, not delivered.
# Hetzner webhosting mail (comes with domains bought at Hetzner): create a
# mailbox like noreply@<your-domain> in konsoleH → Email, then:
#   SMTP_HOST=mail.your-server.de   SMTP_PORT=587   SMTP_SECURE=false
#   SMTP_USER=<the full mailbox address>   SMTP_PASSWORD=<mailbox password>
#   MAIL_FROM=<the full mailbox address>
# Any transactional provider (Brevo, Resend, Mailgun, ...) works the same way.
# Verify with: npm run mail:test -- you@somewhere.com
#SMTP_HOST=mail.your-server.de
#SMTP_PORT=587
#SMTP_USER=noreply@example.org
#SMTP_PASSWORD=change-me
# 'true' only for implicit TLS on port 465; 587 uses STARTTLS automatically
#SMTP_SECURE=false
#MAIL_FROM=noreply@example.org
```

- [x] **Step 3: `docs/NEW-PROJECT.md`** — insert a new section between §5 (Production config) and §6 (First deploy), renumbering is NOT needed if you title it "5b. Mail (Hetzner webhosting)"; also update the §8 auth paragraph:

New section:

```markdown
## 5b. Mail (Hetzner webhosting)

Registration requires a verification mail, so set up SMTP before inviting
real users (without it, verification links only appear in the API log).

If your domain is registered at Hetzner you already have webhosting mail:

1. **konsoleH** (konsoleh.hetzner.com) → Email → create `noreply@<domain>`
   for the app. Create human inboxes (`info@<domain>`, ...) the same way —
   read them via webmail (webmail.your-server.de) or any IMAP client.
2. Fill the `SMTP_*` block in `.env.production` (see the example file —
   `SMTP_HOST=mail.your-server.de`, port 587, login = full mailbox address).
3. DNS: Hetzner's default SPF record (`v=spf1 +a +mx ?all`) already covers
   their mail servers. Enable DKIM in konsoleH if the option exists for
   your package.
4. Verify: `npm run mail:test -- you@somewhere.com` → mail arrives.

Any transactional provider (Brevo, Resend, ...) works identically — swap
the `SMTP_*` values.
```

§8 changes: replace the sentence "Users can register and log in at `/register` / `/login`; forgot/reset password works end-to-end (see the SMTP note above)." with:

```markdown
Users can register at `/register`; they receive a verification mail and can
log in at `/login` once the link is clicked (without SMTP the link lands in
the API log: `docker compose ... logs api | grep verify-email`).
Forgot/reset password works the same way. Registration ends in a
"check your inbox" screen — that mail arriving is your smoke test for §5b.
```

- [x] **Step 4: `docs/HETZNER-SETUP.md`** — add one line to its intro or ToC area: `Mail setup (Hetzner webhosting SMTP + inboxes): see NEW-PROJECT.md §5b.`

- [x] **Step 5: Verify docs render + script compiles**

Run: `npx tsx tools/scripts/send-test-mail.ts` (no args)
Expected: `Usage: npm run mail:test -- <recipient>` and exit 1.

- [x] **Step 6: Commit**

```bash
git add tools/scripts/send-test-mail.ts package.json .env.production.example docs
git commit -m "docs+tools: Hetzner webhosting mail path + mail:test smoke script"
```

---

### Task 13: Full verification pass

- [x] **Step 1: Quality gate**

Run: `npm run quality`
Expected: all targets green (known FE bundle-budget warning is acceptable).

- [x] **Step 2: E2E**

Run: `docker compose up -d && npx nx e2e frontend-e2e`
Expected: PASS.

- [x] **Step 3: Manual smoke (dev)**

Run `npm run serve:all`, register a user at `http://localhost:4200/register`, confirm: inbox screen appears; API log contains the verification link (`Mail (not sent, no SMTP)`); opening that link verifies + logs in; logout → login works; a second registration + login attempt without verifying shows the resend UI.

- [x] **Step 4: Spec cross-check**

Re-read `docs/superpowers/specs/2026-07-13-hetzner-mail-and-email-verification-design.md` — every spec section must map to shipped code/doc. Fix gaps before declaring done.

- [x] **Step 5: Commit any stragglers, then report**

Summarize what changed, evidence per verification step (exact command outputs), and anything that deviated from this plan.
