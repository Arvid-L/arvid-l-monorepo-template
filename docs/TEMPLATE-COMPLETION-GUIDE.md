# Monorepo Template — Completion Guide

> **Audience:** a Claude Code agent (or Arvid) working _inside_ `~/dev/arvid-l-monorepo-template`.
> **Goal:** finish this nx template so a new project can be created by **branching → renaming → deploying to a fresh Hetzner box** in under an hour, with a solid full-stack baseline already in place.
> **Downstream consumer:** the [Ecclesio](https://github.com/Arvid-L/ecclesio) project will be re-based onto a branch of this template, so decisions here should keep that migration cheap (NestJS module/service/controller + Kysely + DTOs; Angular signals/standalone; shared lib). See the migration notes at the bottom.

---

## 0. Current state (what already works — don't rebuild it)

- **nx 22.4.1** workspace. Angular 21 + NestJS 11 + Kysely + Postgres 16. Jest unit tests + Cypress e2e (`apps/api-e2e`, `apps/frontend-e2e`).
- Projects: `apps/api`, `apps/frontend`, `libs/shared` (`@arvid-l-monorepo-template/shared`).
- **Working example vertical slice** (copy this pattern for every feature): `example` controller/service/module + `example.table` + migration `001_create_examples_table` + FE `example` component/edit-dialog + `example.api.service` + shared `example.dto/model`.
- DB: `database.module.ts` (global Kysely provider, `DATABASE` token), `migrator.ts` using **`ImportMigrationProvider`** + static `_all-migrations.ts` map (bundler-safe — keep this, it's better than a file provider). Helpers: base columns, caching columns, enum helpers, `updated-at-trigger`. Table templates: `base`, `cache`.
- **Migrations already run on API boot** (`main.ts` → `await runMigrations()`).
- `common/filters/http-exception.filter.ts`, shared `api-response.interface` + `create-response.util`.
- `docker-compose.yml` = **dev only**: `postgres` (5432) + `postgres-test` (5433). Env: `.env.dev`, `.env.e2e`.
- `tools/scripts/create-migration.ts`, bruno collection, eslint/prettier, README.

**Build outputs (needed for Dockerfiles):**

- API: `nx build api` → webpack → `dist/apps/api/` (entry `main.js`). Targets `prune-lockfile` + `copy-workspace-modules` already emit `dist/apps/api/package.json` + `workspace_modules` — **use these in the API Dockerfile** for a slim runtime image.
- Frontend: `nx build frontend` → `dist/apps/frontend/browser/` (Angular `@angular/build:application`).

---

## P0 — Production deploy story (the actual blocker)

The template today can only run a dev DB. None of the production containerization exists. Port + generalize from Ecclesio (`~/dev/ecclesio`), which has working versions of all of this.

- [x] **`apps/api/Dockerfile`** — multi-stage. Note: the planned `prune-lockfile`/`copy-workspace-modules` targets were broken AND redundant (webpack's `generatePackageJson: true` already emits a pruned `package.json`/`package-lock.json` into `dist/apps/api`, shared lib is bundled into `main.js`); those targets were removed. Runtime = `node:22-alpine`, `npm ci --omit=dev` against the generated package files, `CMD ["node","main.js"]`.
- [x] **`apps/frontend/Dockerfile`** — multi-stage, runtime `nginx:alpine` + SPA-fallback conf (`apps/frontend/nginx.conf`).
- [x] **`docker-compose.prod.yml`** — postgres + api + frontend + nginx + certbot (tls profile). Parametrized via `PROJECT_NAME`/`ENV_NAME`, DB bound to `127.0.0.1`, healthchecks wired (use `127.0.0.1` in-container, not `localhost` — busybox wget prefers ::1).
- [x] **`infrastructure/nginx/`** — two envsubst template sets rendered by the stock nginx image: `templates-http` (local smoke test + pre-TLS bootstrap) and `templates-tls` (redirect + 443 with `${DOMAIN}` certs). Switched via `NGINX_TEMPLATES` in `.env.production`.
- [x] **TLS bootstrap** — `scripts/init-tls.sh`: certbot webroot issuance, flips `NGINX_TEMPLATES=templates-tls` + `COMPOSE_PROFILES=tls`, restarts nginx. Renewal runs as the certbot compose service; nginx reloads every 6h.
- [x] **`scripts/deploy-remote.sh`** + **`scripts/redeploy.sh`** — generalized; config comes from `.env.production` (`PROJECT_NAME`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`), hostname guard kept (`<PROJECT_NAME>-<ENV_NAME>`, `EXPECTED_HOSTNAME` override).
- [x] **`.env.production.example`** + **`.env.example`** committed; `.env*` gitignored except examples + the non-secret `.env.dev`/`.env.e2e`.
- [x] **Server provisioning notes** — `docs/HETZNER-SETUP.md`.

**Verified 2026-07-12:** `nx run-many -t lint test build` green (5 projects); local `docker compose -f docker-compose.prod.yml --env-file .env.production up --build` → all 4 containers healthy, `GET /api/health` pings the DB through nginx, FE loads through nginx, example CRUD + validation errors work end-to-end, migrations run on boot; `templates-tls` config passes `nginx -t` (self-signed cert smoke test).

---

## P1 — Template-code issues to fix (small, do alongside P0)

- [x] **CORS is hardcoded** — now driven by `CORS_ORIGIN` (comma-separated), defaults to `http://localhost:4200`.
- [x] **`.gitignore` does not ignore `.env*`** — fixed (also `.dockerignore`).
- [x] **Prod env-file naming mismatch** — `production → .env.production` everywhere; in containers no env file exists and dotenv no-ops (env comes from compose).
- [x] **Redundant migrations asset copy** — removed (was a no-op anyway: `nx:run-commands` has no `assets` option).
- [x] **Global `ValidationPipe`** — added (`whitelist` + `transform`). Shared DTOs stay plain interfaces (contract, no class-validator in the FE bundle); the API implements them as decorated classes in `apps/api/src/app/example/dto/` — copy that pattern per feature. Also fixed: `example.service.create()` dropped the `type` field; exception filter now surfaces `getResponse().message` so validation field errors reach the client.
- [x] **Request-logging middleware** — minimal `LoggerMiddleware` (method, url, status, duration).

**Also fixed (found during verification):** `apps/frontend/project.json` `fileReplacements` pointed at `src/environments/` instead of `src/app/environments/` — every production/e2e FE build was broken.

---

## P1 — "Great template" baseline features to add

These make the base worth branching from. Ship the wiring + a tiny example, not a full framework.

- [x] **Env config validation** — `apps/api/src/config/env.validation.ts` (class-validator, consistent with the DTO stack — no Joi/zod dep). Gotcha: validation runs at AppModule decorator evaluation, so the dotenv load lives in `config/load-env.ts` imported FIRST in main.ts.
- [x] **Health endpoint** — done without terminus: existing `GET /api/health` now pings the DB (`select 1` via Kysely, 503 on failure) and is wired into the compose healthchecks for `api` + `frontend`. Swap to `@nestjs/terminus` only if a project needs multi-indicator checks.
- [x] **OpenAPI/Swagger** — `/api/docs`, non-prod only (verified: 200 in dev, 404 in prod). Helmet CSP disabled outside prod because it breaks the Swagger UI.
- [x] **CI** — `.github/workflows/ci.yml` (nx affected + nx-set-shas, cypress binary skipped). NOT yet proven green on GitHub — template not pushed. GHCR image push still optional/open.
- [x] **Pre-commit** — Husky + lint-staged (prettier + eslint --fix on staged files).
- [x] **Security headers** — helmet (verified headers on prod compose).
- [x] **`.vscode/extensions.json`** — nx-console, angular, eslint, prettier, jest-runner, tailwind.
- [x] **Frontend baseline** — ToastService (MatSnackBar), global functional `httpErrorInterceptor` (components keep success toasts; errors toast once globally), Material 3 theme (was already wired), Tailwind v4 via `@tailwindcss/postcss`. Note: `provideHttpClient` was absent before this — that _works_ in Angular 21 (HttpClient/HttpHandler are `providedIn: 'root'`, verified in framework source + live-site logs), but interceptors require the explicit `provideHttpClient(withInterceptors([...]))` in app.config. e2e spec rewritten to cover the example CRUD round-trip — run it (`nx e2e frontend-e2e`) before calling FE work done. Runtime-config (one build, all envs) still open/optional.
- [x] **Shared baseline** — `PaginationRequest`/`PaginatedResponse` + `ErrorCode` enum, mapped into the exception filter's `ErrorResponse.errorCode`.
- [x] **Seed mechanism** — `npm run db:seed` (idempotent, tools/scripts/seed.ts).

---

## P1 — The highest-leverage feature: a project-init/rename script

For "branch off and go fast," the biggest friction is renaming everything. Add:

- [x] **`tools/scripts/init-project.ts`** — `npm run init-project -- <name> [--reset-git]`: rewrites kebab/Pascal/Title forms of the template name across every text file (npm scope + imports, tsconfig paths, container/DB/volume names, deploy defaults, titles incl. package-lock), optional fresh git history. Documented in README + `docs/NEW-PROJECT.md` (full branch-off → live-HTTPS walkthrough).

  **Verified 2026-07-12:** ran in a clean clone (`somenewproject --reset-git`) — zero leftover occurrences, `nx run-many -t lint test build` green in the renamed repo, no `npm ci` re-run needed. Also fixed: `tsx` was never a devDep although `create-migration` requires it.

---

## P2 — Nice-to-have

- [x] **Auth scaffold** (2026-07-13, verified live) — vertical slice, opt-in by design: `users` migration + scrypt hashing (node crypto, no native deps), `@nestjs/jwt` without passport, `POST /auth/login` + protected `GET /auth/me` (the pattern to copy), `JwtAuthGuard` + `@CurrentUser`, shared `LoginDto`/`LoginResponse`/`AuthUser`, FE token storage + Bearer interceptor + `authGuard` stub (no login UI — project-specific). Users are created via `npm run user:create -- <email> <password>` — deliberately no open registration endpoint. `JWT_SECRET` env-validated (min 16 chars). To secure the whole API: register `JwtAuthGuard` as `APP_GUARD` + add a `@Public()` decorator. _(Partially superseded by the Tier-1 round below: open registration + login UI exist now.)_

- [x] **Rate limiting** (2026-07-13, verified live: 429 after budget) — global `ThrottlerGuard` 100/min per IP + strict `@Throttle` (5/min) on `/auth/login` + `/auth/refresh`. `trust proxy` set in main.ts so IPs come from `X-Forwarded-For` behind the edge nginx.
- [x] **Dependabot** — npm weekly (grouped: angular/nestjs/nx/minor-and-patch) + github-actions weekly.
- [x] **Refresh tokens with rotation** (2026-07-13, verified live) — opaque 48-byte tokens, only sha256 hashes stored (`refresh_tokens` table, cascade on user delete); every `POST /auth/refresh` revokes the used token and issues a new pair, `POST /auth/logout` revokes; access token default shortened to 15m (`JWT_EXPIRES_IN`), refresh TTL `REFRESH_TOKEN_TTL_DAYS` (default 30). FE: interceptor silently refreshes once on 401 and retries; refresh is single-flight (rotation breaks parallel refreshes); interceptor order in app.config is load-bearing (httpError first, auth second — retry happens before the toast).

### Tier-1 baseline round (2026-07-13, all verified: unit tests + live smoke + e2e)

- [x] **Roles (RBAC)** — pg enum `user_role` (admin/moderator/user, default user), role rides in the JWT (up to 15m stale after role change — forced re-login applies immediately), hierarchical `RolesGuard` (`@Roles(MODERATOR)` admits admin), `GET /auth/users` admin-only = pattern to copy. `user:create` takes optional role arg; omitting it never demotes an existing user.
- [x] **Open registration** — `POST /auth/register`, always USER role, 409 via unique index (race-safe, no pre-SELECT), same 5/min throttle. Emails normalized lowercase in all DTOs.
- [x] **Mail module** — nodemailer, `SMTP_*` env all optional: without `SMTP_HOST` mails are logged instead of sent (dev-friendly; prod warns at boot). Compose passes unset optionals as empty strings → `validateEnv` drops `''` values (would fail `@IsInt`/`@IsIn` otherwise).
- [x] **Password reset** — `forgot-password` (always 204, no enumeration; mail send deliberately not awaited so SMTP latency can't leak account existence) + `reset-password` (sha256 single-use token, 1h TTL, new request kills older tokens, reset revokes ALL sessions). Reset link = `APP_BASE_URL/reset-password?token=…`.
- [x] **FE auth UI** — login/register/forgot/reset Material pages sharing `auth-page.scss`, signal-based `AuthService` (session restore via `/auth/me` after reload), toolbar login/logout, `authGuard` redirects to `/login?returnUrl=…`. e2e `auth.cy.ts`: register→logout→login + wrong-password toast.
- [x] **Structured logging** — nestjs-pino: JSON + req ids in prod (honors upstream `X-Request-Id`), pino-pretty in dev, `authorization`/`cookie` redacted, `/api/health` excluded. `bufferLogs: true` + `useLogger(app.get(PinoLogger))`.
- [x] **Token purge cron** — `@nestjs/schedule` daily 04:00 deletes expired/revoked refresh + used/expired reset tokens.
- [x] **DB backups** — `scripts/backup-db.sh` (gzipped pg_dump, rotation, optional `BACKUP_REMOTE` push) + `restore-db.sh` (confirmed destructive, stops API). Round-trip verified locally: backup → delete users → restore → login OK. Cron install in HETZNER-SETUP.md §7.
- [x] **Migrator silent-death fix** — `process.exit(1)` right after an async pino log swallowed migration errors (container restart-looped with zero output). Now throws; the rejection prints synchronously.

### Tier-2 round (2026-07-18, all verified: unit tests + full e2e suite green)

Account settings, admin user management, pagination convention, legal pages, i18n.

- [x] **i18n (Transloco)** — en + de under `apps/frontend/public/i18n/`, toolbar language toggle, `getTranslocoTestingModule()` preloads real English copy so component specs keep asserting visible strings; MatPaginator labels localized app-wide via a `MatPaginatorIntl` bridge.
- [x] **Legal pages + 404 + footer** — `/imprint` + `/privacy` placeholder pages (copy lives in the i18n files — downstream projects must replace it, see NEW-PROJECT.md §2b), wildcard 404 route, footer links.
- [x] **Pagination convention** — shared `PageRequest`/`PageResponse`, API-side `PageQueryDto` + `resolveSort` with a per-feature column whitelist (guarded against prototype-chain keys), example slice = reference implementation; FE example list uses MatPaginator.
- [x] **Registration extras** — optional display name + mandatory privacy-consent checkbox (stored as `privacy_consented_at`; register links to `/privacy`); toolbar shows `displayName || email`; `PATCH /auth/profile`, DB-backed `GET /auth/me`.
- [x] **Account self-service** (`/settings`) — change password, change email, delete account. Key decisions:
  - **400-vs-401 rule:** a wrong password on an _authenticated_ endpoint returns 400, never 401 — a 401 would make the FE interceptor try a token refresh and log the user out mid-form.
  - **Change email** sends the verification link to the NEW address; the email only flips once the link is clicked (no takeover via typo, old address keeps working until then). Change password revokes all _other_ sessions and returns a fresh token pair.
  - **Delete account = hard delete** (not `deleted_at`): GDPR erasure, and a soft-deleted row would squat on the unique email index forever. All token tables cascade on the user FK, so one `DELETE FROM users` erases everything.
- [x] **Admin user management** — paginated `GET /auth/users` (default sort `createdAt desc` so fresh accounts are on page 1), `PATCH /auth/users/:id/role` + `/status`, self-change guarded (an admin cannot demote/disable themselves); disabled accounts get 403 `ACCOUNT_DISABLED` on login/verify/change-password. FE `/admin/users` table with role select + disable/enable; **`adminGuard` reads the role from the stored JWT synchronously** (no race with the async `/auth/me` session restore) — UI-gating only, the API enforces.
- [x] **E2E round** (settings + admin specs) — surfaced two real issues, both fixed:
  - **Multi-segment routerLink bug:** `[routerLink]="['/', 'admin/users']"` 404s — the Angular router only splits the FIRST commands-array element on `/`, later elements become ONE segment (`/admin%2Fusers`). Fix: single-string form `[routerLink]="'/' + ROUTES.ADMIN_USERS"`; regression unit test pins the href.
  - **Credential throttle vs e2e:** the suite makes more login requests per minute than the 5/min brute-force limit allows. New optional `THROTTLE_CREDENTIAL_LIMIT` env var (default 5) raised to 100 in `.env.e2e` only — nx auto-loads `.env.e2e` (workspace-root `.env.<target>`) into the whole e2e task tree, which is also how the e2e API gets its test-DB config.

### Deferred — pick up when the trigger hits

1. **Jest coverage thresholds** — skipped by choice for now.
2. **FE runtime config** (one build serves all envs) — when a project gets a second deployed environment.
3. **GHCR image-push workflow** — if the deploy model changes from build-on-server to pull-prebuilt-images (>1 server or slow-build pain).
4. **`nx release` + changelog** — only if the template itself gets versioned releases.
5. **Feature-slice nx generator** — when copying the example slice by hand gets old.
6. **File storage module (S3-compatible)** — first project that needs uploads.
7. **Background jobs (pg-boss, no redis needed)** — first async job.
8. **Error tracking (Sentry/GlitchTip)** — when real users exist.

---

## Suggested order of work

1. **P0 deploy** (Dockerfiles → prod compose → nginx → deploy scripts → env examples → gitignore fix). Verify: `docker compose -f docker-compose.prod.yml up --build` runs api+frontend+nginx+db locally, `/api/health` + FE reachable.
2. **P1 code fixes** (CORS/env/validation/logging) — cheap, do while touching those files.
3. **P1 init-project script + README deploy docs** — unlocks fast branching.
4. **P1 baseline features** (config validation, health, swagger, CI, husky).
5. **P2** as needed.

**Definition of done for "template is finished":** from a clean checkout you can run `init-project`, provision a Hetzner box, run the deploy script, and reach a live HTTPS site with the example feature working and migrations applied — with lint/test/build green in CI.

> **PROVEN on a real deploy 2026-07-12:** `arvid-linde-web` branched off, deployed to a Hetzner CX23 → https://arvidlin.de live with LE cert, HTTP→HTTPS redirect, IPv4+IPv6, example CRUD + migrations working. Two bugs found and fixed during the run (compose env-precedence in init-tls.sh; apt-lock/host-nginx friction documented in HETZNER-SETUP.md). Still open: CI (no green-in-CI yet), P1 baseline features.

---

## Notes for the eventual Ecclesio migration (keep these cheap)

- Ecclesio is **plain npm workspaces** with `apps/backend` / `packages/shared` (`@shared` alias) — this template is nx with `apps/api` / `libs/shared`. Migration = mechanical port + import-path rename. Keep the example-feature pattern identical so ported features drop in.
- Ecclesio uses **PostGIS** (only its `hierarchy` feature + `hierarchy_nodes` migration). Make the Postgres image **swappable to `postgis/postgis:16-3.4`** in compose so that's a one-line change, not a re-architecture.
- Ecclesio migrations use Kysely `FileMigrationProvider`; porting them means adding 6 entries to `_all-migrations.ts` — trivial, another reason to keep the import-map.
- Full Ecclesio review + a per-feature migration effort estimate (~3–5 focused days) lives in Arvid's Claude memory (see `CLAUDE.md` in this repo for how to load it).
