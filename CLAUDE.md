# CLAUDE.md — arvid-l-monorepo-template

Clean **nx** base (Angular 21 + NestJS 11 + Kysely + Postgres 16, Jest + Cypress) meant to be **branched into new full-stack projects and deployed to a Hetzner box**. First real downstream user: the Ecclesio church-wiki project.

## Start here

- **`docs/TEMPLATE-COMPLETION-GUIDE.md`** — the actionable P0/P1/P2 checklist for finishing this template (deploy story, code fixes, baseline features, init-project script). Read it before making changes.

## Conventions

- Feature pattern = copy the `example` vertical slice: Nest module/service/controller + `*.table.ts` + migration in `_all-migrations.ts` map + FE component + `*.api.service` + shared dto/model in `libs/shared`.
- Migrations run on API boot (`apps/api/src/main.ts` → `runMigrations()`); keep the static `ImportMigrationProvider` + `_all-migrations.ts` map (bundler-safe).
- Shared import alias: `@arvid-l-monorepo-template/shared` (rename per project via the planned `init-project` script).
- Build outputs: API → `dist/apps/api` (`main.js`); FE → `dist/apps/frontend/browser`.
- Package manager is **pnpm** (version pinned by `packageManager` in `package.json`; pnpm settings and the `allowBuilds` list live in `pnpm-workspace.yaml`). Use `pnpm install`, `pnpm run <script> <args>` (no `--` separator: pnpm passes it through literally) and `pnpm exec nx|jest|tsx ...`. Never use npm/npx, and never commit a `package-lock.json`.
- pnpm installs must run **unsandboxed**: pnpm 12 can't reach the registry inside the Claude sandbox, and the shared store `~/Library/pnpm/store` is outside the sandbox write allowlist (sandboxed, pnpm silently falls back to a full per-checkout store in `node_modules/.pnpm-store`). Everything else (`pnpm run`, `pnpm exec`) works sandboxed once `node_modules` exists.

## Persistent memory / cross-project context

Arvid uses a file-based memory plugin keyed by **project path**:
`~/.claude/projects/-Users-arvidlindenau-dev-arvid-l-monorepo-template/memory/`
It has been **seeded** with the relevant memories from the Ecclesio review (user profile, template state, deploy gaps, migration plan, Ecclesio overview) plus a `MEMORY.md` index. These load automatically for an agent working in this repo. The originals live under the ecclesio project's memory dir; keep the two in sync manually if either changes.
