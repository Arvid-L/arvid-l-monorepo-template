# Deploying to a fresh Hetzner box

One-time server provisioning + first deploy. After this, every deploy is a
single `./scripts/deploy-remote.sh` from your machine.

Assumes: a Hetzner Cloud server (smallest CX instance is fine), a domain, and
your SSH key added during server creation.

Mail setup (Hetzner webhosting SMTP + inboxes): see NEW-PROJECT.md §5b.

## 1. DNS

Create an **A record** for your domain pointing at the server's IPv4 address
(plus an AAAA record for IPv6 if you want). Do this first — Let's Encrypt
needs it to resolve before TLS can be initialized.

## 2. Provision the server (as root)

```bash
# Set the hostname — must match <PROJECT_NAME>-<ENV_NAME> from .env.production.
# scripts/redeploy.sh refuses to run if this doesn't match (safety guard).
hostnamectl set-hostname my-project-prod

# Install Docker (includes the compose plugin)
curl -fsSL https://get.docker.com | sh

# Firewall: SSH + HTTP + HTTPS only
apt-get update && apt-get install -y ufw git
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

> The postgres container binds to `127.0.0.1` only and is never exposed
> publicly. For DB admin access use an SSH tunnel:
> `ssh -L 5432:localhost:5432 root@<server>`.

## 3. Clone the project

```bash
mkdir -p /opt/my-project
git clone <your-repo-url> /opt/my-project
```

`DEPLOY_PATH` in `.env.production` must point at this directory.

## 4. First deploy (from your local machine)

```bash
cp .env.production.example .env.production
# fill in: PROJECT_NAME, DOMAIN, LETSENCRYPT_EMAIL, DATABASE_*, DEPLOY_*

./scripts/deploy-remote.sh
```

This scp's `.env.production` to the server and runs `scripts/redeploy.sh`
there (git pull, image build, `docker compose up`). Migrations run
automatically on API boot.

The site is now reachable over **HTTP**: `http://<your-domain>`.

## 5. Enable HTTPS (one-time, on the server)

```bash
ssh root@<server>
cd /opt/my-project && ./scripts/init-tls.sh
```

The script issues a Let's Encrypt certificate, switches nginx to the TLS
config (HTTP now redirects to HTTPS) and starts the certbot auto-renewal
service. No further TLS maintenance needed.

## 6. Every deploy after that

```bash
./scripts/deploy-remote.sh
```

## 7. Nightly DB backups (one-time, on the server)

```bash
ssh root@<server>
crontab -e
# add:
30 3 * * * /opt/my-project/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

Dumps land in `/var/backups/<project>` (14 days retention; both configurable
via `BACKUP_DIR` / `BACKUP_KEEP_DAYS` in `.env.production`). For off-site
copies set `BACKUP_REMOTE` to any rsync/scp target — e.g. a
[Hetzner Storage Box](https://www.hetzner.com/storage/storage-box/) — and
every dump is pushed there too.

Restore (destructive, asks for confirmation, stops the API during restore):

```bash
./scripts/restore-db.sh /var/backups/<project>/<db>_<timestamp>.sql.gz
```

Verified round-trip: backup → `DELETE FROM users` → restore → login works.

## Sanity checks

```bash
curl -fsS https://<your-domain>/api/health        # {"success":true,...}
docker compose -f docker-compose.prod.yml --env-file .env.production ps   # on the server
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
```

## Known friction (seen on real deploys)

- **apt lock on fresh boxes:** unattended-upgrades often holds the apt lock
  right after boot — `get.docker.com` then fails with `Could not get lock`.
  Wait for it: `while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 5; done`
- **Box previously served a site:** stop the host nginx and its certbot timer
  first, or ports 80/443 are taken:
  `systemctl disable --now nginx certbot.timer`

## Variations

- **PostGIS**: swap the postgres image in `docker-compose.prod.yml` (and
  `docker-compose.yml` for dev) to `postgis/postgis:16-3.4-alpine`. Nothing
  else changes.
- **www subdomain**: add a `www` A record, then extend `server_name` in both
  `infrastructure/nginx/templates-tls/default.conf.template` blocks with
  `www.${DOMAIN}` and add `-d "www.$DOMAIN"` to the certbot call in
  `scripts/init-tls.sh` before running it.
- **Non-root deploys**: create a user, add it to the `docker` group, set
  `DEPLOY_USER` accordingly and clone `/opt/<project>` with that user as owner.

## Local smoke test of the prod stack

```bash
cp .env.production.example .env.production   # defaults are fine locally
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl -fsS http://localhost/api/health
open http://localhost
```
