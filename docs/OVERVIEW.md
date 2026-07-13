# Template Overview — state as of 2026-07-13

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
- Swagger at `/api/docs` (non-prod) · helmet · request logging
- **Auth (opt-in):** JWT login + rotating refresh tokens (hashed server-side,
  revocable, 15m access / 30d refresh), `JwtAuthGuard` + `@CurrentUser`,
  users via `npm run user:create -- <email> <pw>` (no open registration)
- Rate limiting: 100/min per IP global, 5/min on login/refresh

**Frontend baseline**

- Toast service + global HTTP-error interceptor (errors toast once, globally)
- Auth stubs: token storage, Bearer interceptor with silent single-flight
  refresh-on-401, `authGuard` route guard (bring your own login UI)

**Deploy (the crown jewel)**

- `docker-compose.prod.yml`: postgres + api + frontend + edge nginx + certbot
- HTTP/HTTPS nginx template sets, `${DOMAIN}` via envsubst — zero config edits
- `scripts/deploy-remote.sh` (scp env + build on server), `redeploy.sh`
  (hostname-guarded), `init-tls.sh` (one-time Let's Encrypt + auto-renewal)
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

# To production (server setup: docs/HETZNER-SETUP.md)
cp .env.production.example .env.production   # fill in, never committed
./scripts/deploy-remote.sh                   # every deploy
ssh <server> 'cd /opt/<proj> && ./scripts/init-tls.sh'   # HTTPS, once
```

## What's still missing (deliberate, with triggers)

| Item                                    | Do it when                                              |
| --------------------------------------- | ------------------------------------------------------- |
| Login UI                                | project needs auth — backend + FE plumbing already done |
| Jest coverage thresholds                | you start caring about coverage decay                   |
| FE runtime config (one build, all envs) | a second deployed environment exists                    |
| GHCR prebuilt images                    | >1 server or server builds get too slow                 |
| `nx release` / changelog                | the template itself gets versioned releases             |
| Terminus multi-check health             | more infra (redis, s3, …) joins the stack               |

## Where to read more

- `docs/NEW-PROJECT.md` — branch-off → live HTTPS, step by step
- `docs/HETZNER-SETUP.md` — server provisioning + known friction
- `docs/TEMPLATE-COMPLETION-GUIDE.md` — full history of what was built and
  why (template-internal; delete in downstream projects)
