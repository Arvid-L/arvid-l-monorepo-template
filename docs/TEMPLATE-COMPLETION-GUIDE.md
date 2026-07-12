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

- [ ] **`apps/api/Dockerfile`** — multi-stage. Stage 1 `nx build api` (+ `prune-lockfile`, `copy-workspace-modules`). Runtime stage `node:22-alpine`: copy `dist/apps/api`, its pruned `package.json` + `workspace_modules`, `npm ci --omit=dev`, `CMD ["node","main.js"]`. Do **not** copy the whole monorepo into the runtime image.
- [ ] **`apps/frontend/Dockerfile`** — multi-stage. Build stage `nx build frontend`; runtime `nginx:alpine` serving `dist/apps/frontend/browser`, with an SPA-fallback nginx conf.
- [ ] **`docker-compose.prod.yml`** — `postgres` + `api` + `frontend` + `nginx` (+ certbot). Parametrize container/volume names by a `PROJECT_NAME`/`ENV_NAME` var. Bind DB to `127.0.0.1:5432` only. Model on Ecclesio's `docker-compose-prod.yml`.
- [ ] **`infrastructure/nginx/`** — `nginx.conf` + `default.conf`: serve FE static, reverse-proxy `/api` → `api:3000`, gzip, security headers, HTTP→HTTPS redirect, `/etc/letsencrypt` mount. Copy from Ecclesio's `infrastructure/nginx/`.
- [ ] **TLS bootstrap** — a documented one-time certbot step (Ecclesio assumes `/etc/letsencrypt` already exists). Add `scripts/init-tls.sh` or README steps.
- [ ] **`scripts/deploy-remote.sh`** + **`scripts/redeploy.sh`** — generalize Ecclesio's: replace hardcoded `ecclesio` / `ecclesio-prod` / `/opt/ecclesio` with env vars (`PROJECT_NAME`, `REMOTE_HOST`, `REMOTE_PATH`). Keep the hostname safety-guard pattern.
- [ ] **`.env.production.example`** + **`.env.example`** (committed, no secrets). Real `.env.production` is scp'd by the deploy script, never committed.
- [ ] **Server provisioning notes** (README or `docs/HETZNER-SETUP.md`): Docker install, `ufw` firewall (80/443/22), DNS A-record, non-root deploy user, `/opt/<project>` layout, first `git clone`.

---

## P1 — Template-code issues to fix (small, do alongside P0)

- [ ] **CORS is hardcoded** to `http://localhost:4200` in `apps/api/src/main.ts`. Drive from env (`CORS_ORIGIN`), default to localhost in dev.
- [ ] **`.gitignore` does not ignore `.env*`.** Add `.env*` with `!.env.example` / `!.env.production.example` exceptions so secrets can't be committed. (Ecclesio leaked a plaintext token to disk this way — avoid it here.)
- [ ] **Prod env-file naming mismatch:** `main.ts` `NODE_ENV_FILE_RECORD` maps `production → .env`, but the deploy convention is `.env.production`. Pick one and align the deploy script + main.ts.
- [ ] **Redundant migrations asset copy:** `apps/api/project.json` build copies `src/database/migrations` → `dist/apps/api/migrations`, but the migrator uses the static import-map, not files. Remove the asset (or delete the import-map and use a file provider — but keep import-map, drop the asset).
- [ ] **No global `ValidationPipe`.** DTOs exist but aren't validated. Add `app.useGlobalValidationPipe(new ValidationPipe({ whitelist: true, transform: true }))` and `class-validator`/`class-transformer` deps.
- [ ] **No request-logging middleware.** Ecclesio has `LoggerMiddleware`; port a minimal one (or use pino).

---

## P1 — "Great template" baseline features to add

These make the base worth branching from. Ship the wiring + a tiny example, not a full framework.

- [ ] **Env config validation** — `@nestjs/config` with a Joi/zod schema that fails fast if DB vars are missing. One place to see every required env var.
- [ ] **Health endpoint** — `@nestjs/terminus` `GET /api/health` with a DB ping; wire into compose healthchecks for `api` + `frontend`.
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

- [ ] **`tools/scripts/init-project.ts`** — takes a new project name/scope and rewrites, across the repo:
  - npm scope `@arvid-l-monorepo-template` → `@<project>` (package.json, `tsconfig.base.json` paths, all imports)
  - `libs/shared` project name, container names, DB names in compose + `.env.*`
  - `PROJECT_NAME` in deploy scripts, README title
  - resets git history (optional flag) / updates `README.md`

  Document it in the README as **step 1** of starting a new project. This is what turns the template into a true "branch and deploy" base.

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
