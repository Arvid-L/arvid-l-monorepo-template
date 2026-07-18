# Template Overview — state as of 2026-07-18

One-page tour of `arvid-l-monorepo-template`. Everything below is implemented,
tested and **proven on a real deploy** (arvidlin.de, Hetzner CX23).

## What this is

An nx monorepo you branch into new full-stack projects: **Angular 21 +
NestJS 11 + Kysely + Postgres 16**, Jest + Cypress, Docker deploy with
one-command HTTPS. Branch → rename → deploy in under an hour.

## What's included

**Architecture**

- `apps/api` (NestJS) · `apps/frontend` (Angular, signals/standalone,
  Material 3 + Tailwind 4) · `libs/shared` (DTO/model contracts, FE+BE)
- **Example vertical slice** — `example` CRUD end-to-end (migration → table →
  service/controller → shared types → FE api.service → component). Copy it
  for every feature; delete when you don't need the reference.
- Migrations run on API boot; bundler-safe static import-map
  (`_all-migrations.ts`). `npx nx run api:create-migration -- <name>`
  scaffolds one.

**API baseline**

- Fail-fast env validation (`config/env.validation.ts` = the list of all env vars)
- Global ValidationPipe + class-validator DTO classes (shared stays interfaces)
- Exception filter with field errors + typed `ErrorCode` enum
- `/api/health` with DB ping (wired into compose healthchecks)
- Swagger at `/api/docs` (non-prod) · helmet
- Structured logging (nestjs-pino): JSON + request ids in prod, pretty in
  dev, auth headers redacted, health checks excluded
- **Auth:** register/login + rotating refresh tokens (hashed server-side,
  revocable, 15m access / 30d refresh), `JwtAuthGuard` + `@CurrentUser`
- **Email verification (hard gate):** register creates the account
  unverified and mails a link (`/verify-email?token=…`, 24h, single-use,
  60s resend limit); login answers `403` + `errorCode: EMAIL_NOT_VERIFIED`
  until the link is clicked; verifying logs the user straight in.
  `user:create` accounts are pre-verified (bootstrap/admin path)
- **Roles:** admin/moderator/user hierarchy in the JWT; `@Roles()` +
  `RolesGuard` (`GET /auth/users` = the admin-endpoint pattern); promote
  via `npm run user:create -- <email> <pw> admin`
- **Password reset:** forgot/reset endpoints (single-use hashed tokens, 1h,
  resets kill all sessions), mail via nodemailer — without SMTP\_\* env the
  mail lands in the log, so the flow works in dev out of the box
- **Account self-service:** change password (revokes all other sessions,
  returns a fresh token pair), change email (verification link goes to the
  NEW address — the email only flips once the link is clicked), delete
  account (hard delete; FK cascade erases all tokens — GDPR erasure, not a
  soft delete)
- **Admin endpoints:** paginated `GET /auth/users`, `PATCH
/auth/users/:id/role` + `/status` (self-change guarded — an admin cannot
  demote or disable themselves); disabled accounts are rejected with 403 +
  `errorCode: ACCOUNT_DISABLED` at login and on token use
- **Pagination convention:** shared `PageRequest`/`PageResponse` + API-side
  `PageQueryDto` and a `resolveSort` column whitelist per feature — the
  example slice is the reference implementation
- Rate limiting: 100/min per IP global, 5/min on credential endpoints
  (`THROTTLE_CREDENTIAL_LIMIT` raises it in `.env.e2e` only — the Cypress
  suite logs in faster than a human)
- Daily cron purges expired tokens (`@nestjs/schedule` wired)

**Frontend baseline**

- Toast service + global HTTP-error interceptor (errors toast once, globally)
- **Auth UI:** login / register / forgot-password / reset-password /
  verify-email pages (Material), toolbar with session state, `authGuard`
  with returnUrl; register ends in a "check your inbox" state with resend
  cooldown, login offers resend on unverified accounts; register asks for
  an optional display name + a mandatory privacy-policy consent checkbox
  (links to `/privacy`); the toolbar shows `displayName || email`
- **Settings page** (`/settings`): profile (display name), change password,
  change email, delete account — one card per concern
- **Admin users page** (`/admin/users`): paginated table with role select
  and disable/enable; `adminGuard` reads the role straight from the stored
  JWT (synchronous — no race with the async session restore), toolbar link
  renders for admins only; the API enforces regardless
- **i18n:** Transloco with en + de, toolbar language toggle, every UI
  string lives in `public/i18n/*.json`; `getTranslocoTestingModule()` keeps
  component specs asserting real English copy; MatPaginator labels are
  localized app-wide via a `MatPaginatorIntl` bridge
- **Legal pages + 404 + footer:** `/imprint` + `/privacy` (placeholder
  copy — replace per project), wildcard 404 page, footer links on every page
- Token storage, Bearer interceptor with silent single-flight
  refresh-on-401, session restore after reload via `/auth/me`

**Deploy (the crown jewel)**

- `docker-compose.prod.yml`: postgres + api + frontend + edge nginx + certbot
- HTTP/HTTPS nginx template sets, `${DOMAIN}` via envsubst — zero config edits
- `scripts/deploy-remote.sh` (scp env + build on server), `redeploy.sh`
  (hostname-guarded), `init-tls.sh` (one-time Let's Encrypt + auto-renewal)
- `backup-db.sh` (nightly cron: gzipped pg_dump, rotation, optional
  off-site push) + `restore-db.sh` — round-trip verified
- **Mail:** documented Hetzner-webhosting SMTP path (NEW-PROJECT.md §5b:
  konsoleH mailbox → `SMTP_*` env) + `npm run mail:test -- <recipient>`
  smoke script; any transactional provider works the same way
- Postgres → PostGIS = one image line in both compose files

**DX / CI**

- `npm run init-project -- <name> --reset-git` — full rename, verified clean
- CI: full pipeline on main, `nx affected` on PRs · Dependabot (majors for
  nx/Angular excluded — those go through `nx migrate`)
- Husky + lint-staged · seed script · bruno collection · vscode extensions

## How to use it

```bash
# New project (full walkthrough: docs/NEW-PROJECT.md)
git clone <this-repo> myproject && cd myproject
npm ci && npm run init-project -- myproject --reset-git

# Daily dev
docker compose up -d        # dev DB :5432, e2e DB :5433
npm run serve:all           # api :3000/api, frontend :4200
npm run quality             # lint + test + build
npx nx e2e frontend-e2e     # real-browser e2e (needs ports 3000/4200 free)
npm run user:create -- me@dev.local secret123 admin   # admin (pre-verified)
# register/login/forgot/reset/verify UI at /login etc.; verification and
# reset mails land in the API log in dev (no SMTP needed) — grep the log
# for the /verify-email link to activate a dev account

# To production (server setup: docs/HETZNER-SETUP.md)
cp .env.production.example .env.production   # fill in, never committed
./scripts/deploy-remote.sh                   # every deploy
ssh <server> 'cd /opt/<proj> && ./scripts/init-tls.sh'   # HTTPS, once
```

## What's still missing (deliberate, with triggers)

| Item                                    | Do it when                                  |
| --------------------------------------- | ------------------------------------------- |
| Jest coverage thresholds                | you start caring about coverage decay       |
| FE runtime config (one build, all envs) | a second deployed environment exists        |
| GHCR prebuilt images                    | >1 server or server builds get too slow     |
| `nx release` / changelog                | the template itself gets versioned releases |
| Terminus multi-check health             | more infra (redis, s3, …) joins the stack   |
| Feature-slice nx generator              | copying the example slice by hand gets old  |
| File storage module (S3-compatible)     | first project needs uploads                 |
| Background jobs (pg-boss)               | first async/long-running job appears        |
| Error tracking (Sentry/GlitchTip)       | real users exist                            |

## Where to read more

- `docs/NEW-PROJECT.md` — branch-off → live HTTPS, step by step
- `docs/HETZNER-SETUP.md` — server provisioning + known friction
- `docs/TEMPLATE-COMPLETION-GUIDE.md` — full history of what was built and
  why (template-internal; delete in downstream projects)
