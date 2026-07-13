# New project from this template — branch-off to live HTTPS

The full path from "I want to build somenewproject" to the app running on
`https://somenewproject.com`. Realistic time: under an hour (plus DNS
propagation).

Running example below: project **somenewproject**, domain
**somenewproject.com**. Substitute your own everywhere.

**Prerequisites:** Node 22 + Docker locally · a domain · a Hetzner Cloud
server (smallest CX works) created with your SSH key · an empty remote git
repo (GitHub etc.).

## 1. Branch off + rename

```bash
git clone <template-repo-url> somenewproject
cd somenewproject
npm ci
npm run init-project -- somenewproject --reset-git
```

The script rewrites the npm scope (`@somenewproject/shared`), nx project
names, container/DB/volume names, deploy defaults and titles across the whole
repo, then starts a fresh git history. Prefer to keep the template's history
instead? Drop `--reset-git` and commit the rename yourself.

Then wire up your repo:

```bash
git remote add origin git@github.com:<you>/somenewproject.git
git push -u origin main
```

Housekeeping: rewrite the `README.md` intro for your project, adapt
`CLAUDE.md`, delete `docs/TEMPLATE-COMPLETION-GUIDE.md` (template-internal).

## 2. Verify + develop locally

```bash
npm run quality        # lint + test + build — must be green
docker compose up -d   # dev DB :5432, e2e test DB :5433
npm run serve:all      # api → localhost:3000/api, frontend → localhost:4200
```

The example feature (CRUD list at the FE root) proves DB → API → shared types
→ FE wiring. Build features by copying that vertical slice (see `CLAUDE.md`
conventions); replace the example slice when you no longer need the
reference.

## 3. DNS

Create an **A record**: `somenewproject.com` → your server's IPv4. Do it now
— it must resolve before the TLS step.

## 4. Provision the server (once, ~10 min)

Full detail in [HETZNER-SETUP.md](HETZNER-SETUP.md); the short version, as
root on the fresh box:

```bash
hostnamectl set-hostname somenewproject-prod   # must be <PROJECT_NAME>-<ENV_NAME>
curl -fsSL https://get.docker.com | sh
apt-get update && apt-get install -y ufw git
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
git clone git@github.com:<you>/somenewproject.git /opt/somenewproject
```

(For a private repo give the server read access, e.g. a deploy key.)

## 5. Production config (local machine)

```bash
cp .env.production.example .env.production   # gitignored — never committed
```

Fill in:

```dotenv
PROJECT_NAME=somenewproject        # already set by init-project
DOMAIN=somenewproject.com
LETSENCRYPT_EMAIL=you@somewhere.com
CORS_ORIGIN=https://somenewproject.com
DATABASE_NAME=somenewproject
DATABASE_USER=somenewproject
DATABASE_PASSWORD=<generate a strong one>
DEPLOY_HOST=<server IP or ssh alias>
DEPLOY_USER=root
DEPLOY_PATH=/opt/somenewproject    # already set by init-project
JWT_SECRET=<openssl rand -hex 32>
APP_BASE_URL=https://somenewproject.com   # used in password-reset mail links
```

Leave `NGINX_TEMPLATES`/`COMPOSE_PROFILES` at their defaults — the TLS script
manages them.

For working password-reset mails also set the `SMTP_*` vars (any
transactional provider or mailbox). Without them the flow still works —
outgoing mail is written to the API log instead of sent.

## 6. First deploy

```bash
./scripts/deploy-remote.sh
```

Copies `.env.production` to the server, builds the images there, starts the
stack; migrations run on API boot. Check: `http://somenewproject.com` shows
the app, `http://somenewproject.com/api/health` returns
`{"success":true,...}`.

## 7. HTTPS (once)

```bash
ssh root@somenewproject.com
cd /opt/somenewproject && ./scripts/init-tls.sh
```

Issues the Let's Encrypt certificate, switches nginx to TLS (HTTP redirects
from then on) and starts the auto-renewal service.
**`https://somenewproject.com` is live.** No recurring TLS maintenance.

## 8. Auth is already built in

Users can register and log in at `/register` / `/login`; forgot/reset
password works end-to-end (see the SMTP note above). Everyone who registers
gets the `user` role. Create your admin account once, on the server:

```bash
ssh root@somenewproject.com 'cd /opt/somenewproject && \
  DATABASE_HOST=127.0.0.1 DATABASE_NAME=... DATABASE_USER=... DATABASE_PASSWORD=... \
  npx tsx tools/scripts/create-user.ts you@somewhere.com <password> admin'
```

Protect API endpoints with `@UseGuards(JwtAuthGuard, RolesGuard)` +
`@Roles(UserRole.ADMIN)` (pattern: `GET /auth/users`), FE routes with
`canActivate: [authGuard]`.

## 9. Nightly DB backups (once, on the server)

```bash
crontab -e   # add:
30 3 * * * /opt/somenewproject/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

Details + restore: [HETZNER-SETUP.md](HETZNER-SETUP.md) §7.

## 10. Everyday loop

```bash
# develop → commit → push to main, then:
./scripts/deploy-remote.sh
```

## Variations & troubleshooting

- **PostGIS, www subdomain, non-root deploys, sanity-check commands:** see
  [HETZNER-SETUP.md](HETZNER-SETUP.md).
- **Prod stack smoke test without a server:**
  `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
  → `http://localhost` (works with the example env defaults).
- **Logs on the server:**
  `docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api`
