# Hetzner webhosting mail + registration email verification — design

Date: 2026-07-13 · Status: approved by Arvid (approach A) · Scope: template repo

## Goal

New projects branched from this template get working mail out of the box:

1. **Sending** via Hetzner webhosting SMTP (the mail service that comes with
   domains bought at Hetzner) — documented happy path, env-driven, provider
   still swappable.
2. **Receiving** = human inboxes only (konsoleH mailboxes, read via mail
   client/webmail). Documentation, no code. No IMAP processing in the app.
3. **Registration email verification** with a hard gate: unverified users
   cannot log in until they click the link mailed to them.

Non-goals: inbound mail processing (IMAP), grace periods / soft gates,
newsletter/bulk sending, email-change flow.

## Decisions taken

- Approach A: mirror the existing password-reset token pattern (opaque token,
  sha256 hash at rest, TTL, invalidate-on-reissue). No shared "one-time token"
  abstraction, no stateless JWT links. Consistency > DRY in a template built
  from copyable slices.
- Hard gate on login, distinct error code so the FE can offer resend.
- Verify endpoint returns a full `LoginResponse` → clicking the link logs the
  user in (one less friction step).
- Existing users (running deployments) are backfilled as verified.

## Data model

One migration, registered in `_all-migrations.ts`:

- `users.email_verified_at` — timestamp, nullable. Backfill existing rows with
  `now()` so no running deployment locks its users out.
- New table `email_verification_tokens`, identical shape to
  `password_reset_tokens`: `id`, `user_id` (FK, cascade delete), `token_hash`
  (sha256 hex), `expires_at`, `used_at`, `created_at`.
  New `email-verification-token.table.ts` next to the existing table files.

## API

**New `EmailVerificationTokensService`** — structural clone of
`PasswordResetTokensService`:

- `issue(userId)` — invalidates prior unused tokens, creates a new one,
  returns the raw token. TTL **24 h** (reset uses 1 h). Minimum 60 s between
  issues per user (naive resend rate-limit).
- `findValid(token)`, `markUsed(id)` — same semantics as reset.

**`UsersService`**: `markEmailVerified(userId)`; `createUser()` gains an
optional pre-verified flag.

**Auth flow (`auth.service.ts` / `auth.controller.ts`):**

- `register()` — creates user, issues token, sends mail with link
  `${APP_BASE_URL}/verify-email?token=<raw>`, returns a message payload,
  **no JWTs** (breaking change vs. current auto-login on register).
- `login()` — unverified user → `403` with error code `EMAIL_NOT_VERIFIED`
  (bad credentials stay `401`; FE branches on the code).
- `POST /auth/verify-email { token }` — validates, marks token used, sets
  `email_verified_at`, returns `LoginResponse` (auto-login).
- `POST /auth/resend-verification { email }` — always `204`; silently no-ops
  for unknown or already-verified mails (no user enumeration).
- `TokenCleanupService` sweeps `email_verification_tokens` alongside the
  existing two tables.
- `tools/scripts/create-user.ts` always creates/updates users as verified
  (admin/bootstrap path).

**Shared lib (`libs/shared`)**: dtos for verify/resend, `EMAIL_NOT_VERIFIED`
error constant, register-response type change.

Mail wording follows the existing password-reset mail structure.

## Frontend

- **Register page**: on success swaps to a "check your inbox" state (shows
  the address, resend button with cooldown feedback). No auto-login.
- **New `/verify-email` page** (route without `authGuard`): reads `?token=`,
  calls verify on load. Success → store tokens, redirect to root, logged in.
  Failure → error state + email field to trigger resend.
- **Login page**: on `EMAIL_NOT_VERIFIED` show a distinct message + inline
  resend action reusing the typed email.
- `auth.api.service`: `verifyEmail(token)`, `resendVerification(email)`.
- `auth.service`: register no longer stores tokens; verify-email response
  handled like a login response.

## Docs / env / tooling

- **NEW-PROJECT.md** — new section "Mail (Hetzner webhosting)": create
  mailboxes in konsoleH (`noreply@<domain>` for the app, optional human
  inboxes like `info@`); SMTP env block (`SMTP_HOST=mail.your-server.de`,
  `SMTP_PORT=587`, `SMTP_USER=<full address>`, `SMTP_SECURE=false`,
  `MAIL_FROM=<full address>`); SPF note (Hetzner default `v=spf1 +a +mx ?all`
  already covers their mail servers); enable DKIM in konsoleH if offered;
  webmail pointer for human inboxes. Registration step gains a "verification
  mail arrives" checkpoint. SMTP-less fallback note stays (link in API log).
- **HETZNER-SETUP.md** — short cross-reference to the mail section.
- **`.env.production.example`** — Hetzner-flavored comments/defaults in the
  SMTP block.
- **`tools/scripts/send-test-mail.ts`** + npm script `mail:test` — sends one
  test mail through the configured SMTP settings (spin-up smoke test).

## Error handling

- Verify with expired/used/unknown token → `400` with a stable error code;
  FE shows error state + resend option.
- Resend never reveals whether an email exists (`204` always).
- Without SMTP configured, MailService keeps logging mails instead of
  sending (existing behavior) — dev flow: fish the link out of the API log.

## Testing

- **API (Jest)**: token lifecycle (issue → verify; expiry; reuse rejected;
  reissue invalidates old; 60 s reissue limit), login hard gate, resend
  no-enumeration, register response shape. Clone structure of existing
  reset-token specs.
- **FE (Jest)**: register inbox-state, verify-email success/failure states,
  login `EMAIL_NOT_VERIFIED` branch.
- **Cypress e2e**: register → "check inbox" screen; unverified login →
  error + resend visible; `/verify-email?token=garbage` → error state.
  Happy verify-click path is covered at API level (raw token only exists in
  the mail log — not worth e2e plumbing).

## Rollout

Template only. arvid-linde-web ports the feature later by pulling from the
template; the backfill migration keeps its existing users verified.
