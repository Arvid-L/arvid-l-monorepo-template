# ArvidLMonorepoTemplate

Monorepo Base Structure for my future projects.

## Start a new project

```bash
git clone <this-repo> my-project && cd my-project
npm ci
npm run init-project -- my-project --reset-git
```

Then follow [docs/NEW-PROJECT.md](docs/NEW-PROJECT.md) — the complete path
from branch-off to the app running on your domain with HTTPS.


## Stack

- Backend: NestJS 11
- Frontend: Angular 
- Typescript

## nx projects

- apps/api
- apps/frontend
- libs/shared


## How to run

```
npm i
npm run serve:all
```

Or if you want to run them separately:

```
nx serve api
nx serve frontend
```

For quality check (tests, build, linting):

```
npm run quality

# or separately
npm run test
npm run lint
npm run build
```

## Local development

`docker compose up -d` starts the dev DB (5432) and e2e test DB (5433) with
the committed non-secret defaults from `.env.dev` / `.env.e2e`.

## Production deploy

The production stack (`docker-compose.prod.yml`) runs postgres + api +
frontend behind an nginx edge proxy with Let's Encrypt TLS.

- **Server setup + first deploy:** see [docs/HETZNER-SETUP.md](docs/HETZNER-SETUP.md)
- **Every deploy after that:** `./scripts/deploy-remote.sh`
- **Local smoke test:**
  `cp .env.production.example .env.production && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
  → frontend on <http://localhost>, API on <http://localhost/api/health>

Migrations run automatically on API boot. Secrets live only in
`.env.production` (gitignored, scp'd to the server by the deploy script).


