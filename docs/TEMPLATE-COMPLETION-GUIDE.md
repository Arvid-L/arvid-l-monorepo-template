# Monorepo Template — Completion Guide

> **Audience:** a Claude Code agent (or Arvid) working *inside* `~/dev/arvid-l-monorepo-template`.
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

- [ ] **Env config validation** — `@nestjs/config` with a Joi/zod schema that fails fast if DB vars are missing. One place to see every required env var.
- [x] **Health endpoint** — done without terminus: existing `GET /api/health` now pings the DB (`select 1` via Kysely, 503 on failure) and is wired into the compose healthchecks for `api` + `frontend`. Swap to `@nestjs/terminus` only if a project needs multi-indicator checks.
- [ ] **OpenAPI/Swagger** — `@nestjs/swagger` at `/api/docs`, gated to non-prod. Biggest single DX win for future features + FE contract.
- [ ] **CI** — `.github/workflows/ci.yml`: `nx affected -t lint test build` on PR (with `nx-set-shas`). Optional second workflow: build + push `api`/`frontend` images to GHCR on tag.
- [ ] **Pre-commit** — Husky + lint-staged (prettier + eslint on staged files).
- [ ] **Security headers** — `helmet` on the API.
- [ ] **`.vscode/extensions.json`** — recommend nx-console, angular, eslint, prettier.
- [ ] **Frontend baseline:** HTTP error interceptor, a simple toast/notification service, Angular Material theme wiring, and (if you want parity with Ecclesio) **Tailwind** setup. Optionally a runtime-config approach so one FE build serves all envs.
- [ ] **Shared baseline:** pagination request/response types + a shared error-code enum, alongside the existing `ApiResponse` envelope.
- [ ] **Seed mechanism** — a `tools/scripts/seed.ts` example.

---

## P1 — The highest-leverage feature: a project-init/rename script

For "branch off and go fast," the biggest friction is renaming everything. Add:

- [x] **`tools/scripts/init-project.ts`** — `npm run init-project -- <name> [--reset-git]`: rewrites kebab/Pascal/Title forms of the template name across every text file (npm scope + imports, tsconfig paths, container/DB/volume names, deploy defaults, titles incl. package-lock), optional fresh git history. Documented in README + `docs/NEW-PROJECT.md` (full branch-off → live-HTTPS walkthrough).

  **Verified 2026-07-12:** ran in a clean clone (`somenewproject --reset-git`) — zero leftover occurrences, `nx run-many -t lint test build` green in the renamed repo, no `npm ci` re-run needed. Also fixed: `tsx` was never a devDep although `create-migration` requires it.

---

## P2 — Nice-to-have

- [ ] Auth scaffold (JWT module + guard + `@CurrentUser` decorator + FE auth interceptor/guard stub) — optional, many projects need it.
- [ ] Rate limiting (`@nestjs/throttler`).
- [ ] Renovate/Dependabot config.
- [ ] `nx release` / conventional-commits + changelog.
- [ ] Coverage thresholds in jest config.

---

## Suggested order of work

1. **P0 deploy** (Dockerfiles → prod compose → nginx → deploy scripts → env examples → gitignore fix). Verify: `docker compose -f docker-compose.prod.yml up --build` runs api+frontend+nginx+db locally, `/api/health` + FE reachable.
2. **P1 code fixes** (CORS/env/validation/logging) — cheap, do while touching those files.
3. **P1 init-project script + README deploy docs** — unlocks fast branching.
4. **P1 baseline features** (config validation, health, swagger, CI, husky).
5. **P2** as needed.

**Definition of done for "template is finished":** from a clean checkout you can run `init-project`, provision a Hetzner box, run the deploy script, and reach a live HTTPS site with the example feature working and migrations applied — with lint/test/build green in CI.

---

## Notes for the eventual Ecclesio migration (keep these cheap)

- Ecclesio is **plain npm workspaces** with `apps/backend` / `packages/shared` (`@shared` alias) — this template is nx with `apps/api` / `libs/shared`. Migration = mechanical port + import-path rename. Keep the example-feature pattern identical so ported features drop in.
- Ecclesio uses **PostGIS** (only its `hierarchy` feature + `hierarchy_nodes` migration). Make the Postgres image **swappable to `postgis/postgis:16-3.4`** in compose so that's a one-line change, not a re-architecture.
- Ecclesio migrations use Kysely `FileMigrationProvider`; porting them means adding 6 entries to `_all-migrations.ts` — trivial, another reason to keep the import-map.
- Full Ecclesio review + a per-feature migration effort estimate (~3–5 focused days) lives in Arvid's Claude memory (see `CLAUDE.md` in this repo for how to load it).
