# Tier-2 Template Round: Account Self-Service, Admin UI, Pagination, Legal Pages, i18n — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything a real project needs _after_ signup: account settings (change password/email, delete account), display names, an admin user-management page with disable/role controls, a reusable pagination convention, legal pages (Impressum/Datenschutz/404), and full en+de i18n via Transloco.

**Architecture:** Extends the existing auth vertical (NestJS `auth` module + Angular `core/auth` + `components/auth`) with new endpoints and pages, all following patterns already in the repo: opaque hashed tokens for email change (reuses `email_verification_tokens`), `errorCode` pass-through in `HttpExceptionFilter` for FE-branchable errors, shared interfaces in `libs/shared` with class-validator classes in `apps/api`. One new dependency: `@jsverse/transloco`. Transloco is wired FIRST so every new screen is written translated from the start.

**Tech Stack:** Nx 22 monorepo — Angular 21 (standalone, signals, Material 3), NestJS 11, Kysely + Postgres 16, Jest, Cypress, @jsverse/transloco.

## Global Constraints

- **Branch:** create `feat/tier2-account-admin-i18n` off `main` before Task 1. Never commit to `main` directly.
- **Prereq every session:** `docker compose up -d` (dev DB :5432, e2e DB :5433). Migrations run on API boot.
- **Shared import alias:** `@arvid-l-monorepo-template/shared`. `libs/shared` holds **interfaces only**; class-validator **classes** live in `apps/api/src/app/auth/dto/` implementing those interfaces.
- **Custom error codes** must go through the `HttpExceptionFilter` pass-through: throw `new ForbiddenException({ statusCode, errorCode: ErrorCode.X, message })`. A bare `code` field gets dropped by the filter.
- **Never use 401 for a wrong-password check on an authenticated endpoint.** The FE interceptor treats 401 as "token expired" → silent refresh → logout on failure. Wrong current password = `BadRequestException` (400).
- **No-enumeration contracts stay:** forgot-password / resend-verification / change-email reissue-limit paths respond success regardless.
- **i18n:** ALL user-facing strings go through Transloco keys with entries in BOTH `en.json` and `de.json`. Default language `en`. **Cypress asserts English copy — the `en` values in this plan are exact and must not be reworded.**
- **Component specs** that render transloco keys need `getTranslocoTestingModule()` (created in Task 2) in their TestBed `imports`.
- **Commits:** conventional commits, imperative subject, one commit per task minimum. Husky + lint-staged reformats staged files on commit — that is expected, don't fight it.
- **Verification commands:** `npx nx test api`, `npx nx test frontend`, `npm run quality` (lint+test+build all), `npx nx e2e frontend-e2e` (kill stale processes first: `lsof -ti :3000 -ti :4200 | xargs kill` — ignore error if nothing runs).
- **Known e2e gotcha:** the cypress webServerCommand backgrounds the API; leaked processes across runs cause phantom 429s/stale code. Always kill :3000/:4200 before an e2e run.
- **Task 7 and Task 8 are a pair:** Task 7 (API requires `privacyAccepted`) breaks the UI register flow until Task 8 updates the form. Do not run e2e between them; run it after Task 8.

## File Map (what gets created/modified where)

```
libs/shared/src/lib/models/page.model.ts                      NEW  PageRequest/PageResponse
libs/shared/src/lib/models/auth.model.ts                      MOD  AuthUser.displayName, new DTOs, AdminUser
libs/shared/src/lib/enums/error-code.enum.ts                  MOD  ACCOUNT_DISABLED
apps/api/src/database/migrations/007_account_management.ts    NEW  users cols + tokens.new_email
apps/api/src/common/pagination/                               NEW  PageQueryDto + utils + spec
apps/api/src/app/auth/                                        MOD  service/controller/users.service/dtos
apps/frontend/public/i18n/{en,de}.json                        NEW  full translation files
apps/frontend/src/app/core/i18n/                              NEW  loader, language service, test helper
apps/frontend/src/app/core/api/admin.api.service.ts           NEW
apps/frontend/src/app/core/auth/admin.guard.ts                NEW
apps/frontend/src/app/components/legal/                       NEW  imprint + privacy
apps/frontend/src/app/components/not-found/                   NEW
apps/frontend/src/app/components/settings/                    NEW
apps/frontend/src/app/components/admin/                       NEW  admin-users page
apps/frontend-e2e/src/e2e/{auth,admin}.cy.ts                  MOD/NEW
docs/{OVERVIEW,NEW-PROJECT,TEMPLATE-COMPLETION-GUIDE}.md      MOD
```

---

### Task 1: Migration 007 + table interfaces

**Files:**

- Create: `apps/api/src/database/migrations/007_account_management.ts`
- Modify: `apps/api/src/database/migrations/_all-migrations.ts`
- Modify: `apps/api/src/database/tables/user.table.ts`
- Modify: `apps/api/src/database/tables/email-verification-token.table.ts`

**Interfaces:**

- Consumes: `createTableWithBaseColumns`-style helpers NOT needed here — plain `alterTable`.
- Produces: `users.display_name varchar(120) NULL`, `users.disabled_at timestamptz NULL`, `users.privacy_accepted_at timestamptz NULL`, `email_verification_tokens.new_email varchar(255) NULL`. Table interfaces expose them as `string | null` / `string | Date | null`.

- [ ] **Step 1: Write the migration**

Create `apps/api/src/database/migrations/007_account_management.ts`:

```typescript
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // display_name: optional public name (fallback in UIs is the email).
  // disabled_at: admin kill switch — set = account cannot log in.
  // privacy_accepted_at: GDPR consent timestamp captured at registration;
  // existing users stay NULL (they predate the checkbox).
  await db.schema.alterTable('users').addColumn('display_name', 'varchar(120)').addColumn('disabled_at', 'timestamptz').addColumn('privacy_accepted_at', 'timestamptz').execute();

  // new_email: when set, the verification token confirms an email CHANGE
  // (link goes to the new address) instead of first-time verification.
  await db.schema.alterTable('email_verification_tokens').addColumn('new_email', 'varchar(255)').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('email_verification_tokens').dropColumn('new_email').execute();
  await db.schema.alterTable('users').dropColumn('privacy_accepted_at').dropColumn('disabled_at').dropColumn('display_name').execute();
}
```

- [ ] **Step 2: Register it in the migration map**

In `apps/api/src/database/migrations/_all-migrations.ts` add the import and map entry (keep numeric order):

```typescript
import * as migration_007_account_management from './007_account_management';
```

```typescript
  migration_006_email_verification,
  migration_007_account_management,
```

- [ ] **Step 3: Extend the table interfaces**

`apps/api/src/database/tables/user.table.ts` — full new content:

```typescript
import { Generated } from 'kysely';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { BaseTable } from './templates/base.table';

export interface UserTable extends BaseTable {
  email: string;
  password_hash: string;
  role: Generated<UserRole>;
  email_verified_at: string | Date | null;
  display_name: string | null;
  disabled_at: string | Date | null;
  privacy_accepted_at: string | Date | null;
}
```

`apps/api/src/database/tables/email-verification-token.table.ts` — add one field to the existing interface:

```typescript
new_email: string | null;
```

- [ ] **Step 4: Run the migration and verify the schema**

```bash
docker compose up -d
npx nx serve api
```

Wait for the boot log (`Application is running`), then Ctrl-C and check:

```bash
set -a; source .env.dev; set +a
docker compose exec -T postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" \
  -c '\d users' -c '\d email_verification_tokens'
```

Expected: `users` shows `display_name`, `disabled_at`, `privacy_accepted_at`; `email_verification_tokens` shows `new_email`.

- [ ] **Step 5: Quality gate + commit**

```bash
npx nx test api && npx nx build api
git add -A && git commit -m "feat(db): account management columns (display_name, disabled_at, privacy consent, token new_email)"
```

---

### Task 2: Transloco wiring (loader, config, full translation files, language toggle, test helper)

**Files:**

- Create: `apps/frontend/src/app/core/i18n/transloco-loader.ts`
- Create: `apps/frontend/src/app/core/i18n/language.service.ts`
- Create: `apps/frontend/src/app/core/i18n/transloco-testing.ts`
- Create: `apps/frontend/public/i18n/en.json`
- Create: `apps/frontend/public/i18n/de.json`
- Modify: `apps/frontend/src/app/app.config.ts`
- Modify: `apps/frontend/src/app/app.component.ts`
- Modify: `apps/frontend/src/app/app.component.html`
- Modify: `apps/frontend/src/app/app.component.spec.ts`
- Modify: `apps/frontend/tsconfig.spec.json`

**Interfaces:**

- Consumes: `apps/frontend/public` asset glob (already copies `public/**` to the web root, so the loader fetches `/i18n/en.json`).
- Produces: `LanguageService { active: Signal<'en'|'de'>; init(): void; set(lang): void; toggle(): void }`; `getTranslocoTestingModule(): ModuleWithProviders` for specs; translation files containing **ALL keys for the entire plan** (later tasks only reference keys, they never edit the JSON).

- [ ] **Step 1: Install transloco**

```bash
npm install @jsverse/transloco
```

Expected: resolves cleanly against Angular 21. If npm reports a peer-dependency conflict, stop and ask — do not use `--legacy-peer-deps`.

- [ ] **Step 2: Create the loader**

`apps/frontend/src/app/core/i18n/transloco-loader.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}
```

- [ ] **Step 3: Create the language service**

`apps/frontend/src/app/core/i18n/language.service.ts`:

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const LANG_KEY = 'lang';
type Lang = 'en' | 'de';

// Owns the active language: persists the choice and keeps a signal the
// toolbar toggle can render. Components never talk to TranslocoService
// directly for switching.
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  readonly active = signal<Lang>('en');

  // Called once at app start (provideAppInitializer in app.config.ts).
  init(): void {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'de') {
      this.set(saved);
    }
  }

  set(lang: Lang): void {
    localStorage.setItem(LANG_KEY, lang);
    this.transloco.setActiveLang(lang);
    this.active.set(lang);
  }

  toggle(): void {
    this.set(this.active() === 'en' ? 'de' : 'en');
  }
}
```

- [ ] **Step 4: Write the FULL translation files**

These contain every key used by ALL later tasks — later tasks never touch these files. The `en` values are load-bearing (Cypress asserts them).

`apps/frontend/public/i18n/en.json`:

```json
{
  "nav": {
    "title": "Arvid L Monorepo",
    "login": "Login",
    "logout": "Logout",
    "settings": "Settings",
    "users": "Users"
  },
  "footer": {
    "imprint": "Imprint",
    "privacy": "Privacy policy"
  },
  "common": {
    "email": "Email",
    "password": "Password",
    "backToLogin": "Back to login",
    "emailRequired": "Email is required",
    "emailInvalid": "Enter a valid email",
    "passwordRequired": "Password is required",
    "passwordMinLength": "At least 8 characters",
    "passwordMismatch": "Passwords do not match"
  },
  "auth": {
    "login": {
      "title": "Login",
      "submit": "Login",
      "unverifiedHint": "This account's email address is not verified yet.",
      "resend": "Resend verification mail",
      "resendSent": "A new mail is on its way — check your inbox.",
      "forgotLink": "Forgot password?",
      "registerLink": "Create account"
    },
    "register": {
      "title": "Create account",
      "displayName": "Display name (optional)",
      "confirmPassword": "Confirm password",
      "privacyPrefix": "I have read and accept the",
      "privacyLinkLabel": "privacy policy",
      "privacyRequired": "You must accept the privacy policy",
      "submit": "Create account",
      "loginLink": "Already have an account? Login",
      "inboxTitle": "Check your inbox",
      "inboxBody": "We sent a verification link to",
      "inboxBodySuffix": ". Click it to activate your account.",
      "resend": "Resend mail"
    },
    "forgot": {
      "title": "Forgot password",
      "sent": "If an account exists for that email, a password reset link is on its way. The link is valid for one hour.",
      "submit": "Send reset link"
    },
    "reset": {
      "title": "Reset password",
      "missingToken": "This link is missing its reset token. Request a new one via",
      "missingTokenLink": "forgot password",
      "newPassword": "New password",
      "confirmNewPassword": "Confirm new password",
      "submit": "Set new password"
    },
    "verify": {
      "verifyingTitle": "Verifying…",
      "verifyingBody": "Checking your verification link.",
      "failedTitle": "Link invalid or expired",
      "resendPrompt": "Request a fresh verification mail:",
      "resend": "Resend verification mail",
      "resendSent": "If that address has an unverified account, a mail is on its way."
    }
  },
  "example": {
    "title": "Examples",
    "addTitle": "Add New Example",
    "name": "Name",
    "namePlaceholder": "Enter name",
    "nameRequired": "Name is required",
    "type": "Type",
    "typeRequired": "Type is required",
    "createdAt": "Created At",
    "actions": "Actions",
    "add": "Add Example",
    "edit": "Edit",
    "delete": "Delete",
    "noData": "No examples found. Create one above!",
    "created": "Example created successfully",
    "deleted": "Example deleted successfully",
    "confirmDelete": "Are you sure you want to delete this example?"
  },
  "settings": {
    "title": "Settings",
    "profile": {
      "title": "Profile",
      "displayName": "Display name",
      "save": "Save",
      "saved": "Profile updated"
    },
    "password": {
      "title": "Change password",
      "current": "Current password",
      "currentRequired": "Current password is required",
      "new": "New password",
      "confirm": "Confirm new password",
      "submit": "Change password",
      "changed": "Password changed — other sessions were logged out"
    },
    "email": {
      "title": "Change email",
      "new": "New email address",
      "password": "Current password",
      "submit": "Send verification mail",
      "sent": "Verification mail sent to",
      "sentSuffix": ". Your email changes once you click the link."
    },
    "danger": {
      "title": "Delete account",
      "body": "Deletes your account and all its data permanently. This cannot be undone.",
      "password": "Current password",
      "submit": "Delete my account",
      "confirm": "Really delete your account? This cannot be undone.",
      "deleted": "Your account has been deleted"
    }
  },
  "admin": {
    "users": {
      "title": "Users",
      "displayName": "Name",
      "email": "Email",
      "role": "Role",
      "verified": "Verified",
      "status": "Status",
      "createdAt": "Created",
      "active": "Active",
      "disabled": "Disabled",
      "disable": "Disable",
      "enable": "Enable",
      "roleChanged": "Role updated",
      "statusChanged": "Status updated",
      "self": "you"
    }
  },
  "legal": {
    "imprint": {
      "title": "Imprint",
      "body": "Placeholder — replace with your Impressum (§ 5 DDG): name, address, contact, and if applicable registry entries and VAT ID."
    },
    "privacy": {
      "title": "Privacy policy",
      "body": "Placeholder — replace with your privacy policy (GDPR Art. 13/14): controller, purposes, legal bases, storage duration, recipients, and data-subject rights."
    }
  },
  "notFound": {
    "title": "Page not found",
    "body": "The page you are looking for does not exist.",
    "home": "Go to home page"
  }
}
```

`apps/frontend/public/i18n/de.json`:

```json
{
  "nav": {
    "title": "Arvid L Monorepo",
    "login": "Anmelden",
    "logout": "Abmelden",
    "settings": "Einstellungen",
    "users": "Benutzer"
  },
  "footer": {
    "imprint": "Impressum",
    "privacy": "Datenschutz"
  },
  "common": {
    "email": "E-Mail",
    "password": "Passwort",
    "backToLogin": "Zurück zur Anmeldung",
    "emailRequired": "E-Mail ist erforderlich",
    "emailInvalid": "Gültige E-Mail-Adresse eingeben",
    "passwordRequired": "Passwort ist erforderlich",
    "passwordMinLength": "Mindestens 8 Zeichen",
    "passwordMismatch": "Passwörter stimmen nicht überein"
  },
  "auth": {
    "login": {
      "title": "Anmelden",
      "submit": "Anmelden",
      "unverifiedHint": "Die E-Mail-Adresse dieses Kontos ist noch nicht bestätigt.",
      "resend": "Bestätigungsmail erneut senden",
      "resendSent": "Eine neue Mail ist unterwegs — prüfe deinen Posteingang.",
      "forgotLink": "Passwort vergessen?",
      "registerLink": "Konto erstellen"
    },
    "register": {
      "title": "Konto erstellen",
      "displayName": "Anzeigename (optional)",
      "confirmPassword": "Passwort bestätigen",
      "privacyPrefix": "Ich habe die",
      "privacyLinkLabel": "Datenschutzerklärung gelesen und akzeptiere sie",
      "privacyRequired": "Die Datenschutzerklärung muss akzeptiert werden",
      "submit": "Konto erstellen",
      "loginLink": "Schon ein Konto? Anmelden",
      "inboxTitle": "Prüfe deinen Posteingang",
      "inboxBody": "Wir haben einen Bestätigungslink gesendet an",
      "inboxBodySuffix": ". Klicke ihn an, um dein Konto zu aktivieren.",
      "resend": "Mail erneut senden"
    },
    "forgot": {
      "title": "Passwort vergessen",
      "sent": "Falls ein Konto mit dieser E-Mail existiert, ist ein Link zum Zurücksetzen unterwegs. Der Link ist eine Stunde gültig.",
      "submit": "Link senden"
    },
    "reset": {
      "title": "Passwort zurücksetzen",
      "missingToken": "Diesem Link fehlt das Reset-Token. Fordere einen neuen an über",
      "missingTokenLink": "Passwort vergessen",
      "newPassword": "Neues Passwort",
      "confirmNewPassword": "Neues Passwort bestätigen",
      "submit": "Neues Passwort setzen"
    },
    "verify": {
      "verifyingTitle": "Wird geprüft…",
      "verifyingBody": "Dein Bestätigungslink wird geprüft.",
      "failedTitle": "Link ungültig oder abgelaufen",
      "resendPrompt": "Fordere eine neue Bestätigungsmail an:",
      "resend": "Bestätigungsmail erneut senden",
      "resendSent": "Falls diese Adresse ein unbestätigtes Konto hat, ist eine Mail unterwegs."
    }
  },
  "example": {
    "title": "Beispiele",
    "addTitle": "Neues Beispiel anlegen",
    "name": "Name",
    "namePlaceholder": "Name eingeben",
    "nameRequired": "Name ist erforderlich",
    "type": "Typ",
    "typeRequired": "Typ ist erforderlich",
    "createdAt": "Erstellt am",
    "actions": "Aktionen",
    "add": "Beispiel anlegen",
    "edit": "Bearbeiten",
    "delete": "Löschen",
    "noData": "Keine Beispiele gefunden. Lege oben eines an!",
    "created": "Beispiel erfolgreich angelegt",
    "deleted": "Beispiel erfolgreich gelöscht",
    "confirmDelete": "Dieses Beispiel wirklich löschen?"
  },
  "settings": {
    "title": "Einstellungen",
    "profile": {
      "title": "Profil",
      "displayName": "Anzeigename",
      "save": "Speichern",
      "saved": "Profil aktualisiert"
    },
    "password": {
      "title": "Passwort ändern",
      "current": "Aktuelles Passwort",
      "currentRequired": "Aktuelles Passwort ist erforderlich",
      "new": "Neues Passwort",
      "confirm": "Neues Passwort bestätigen",
      "submit": "Passwort ändern",
      "changed": "Passwort geändert — andere Sitzungen wurden abgemeldet"
    },
    "email": {
      "title": "E-Mail ändern",
      "new": "Neue E-Mail-Adresse",
      "password": "Aktuelles Passwort",
      "submit": "Bestätigungsmail senden",
      "sent": "Bestätigungsmail gesendet an",
      "sentSuffix": ". Deine E-Mail ändert sich, sobald du den Link anklickst."
    },
    "danger": {
      "title": "Konto löschen",
      "body": "Löscht dein Konto und alle zugehörigen Daten endgültig. Das kann nicht rückgängig gemacht werden.",
      "password": "Aktuelles Passwort",
      "submit": "Mein Konto löschen",
      "confirm": "Konto wirklich löschen? Das kann nicht rückgängig gemacht werden.",
      "deleted": "Dein Konto wurde gelöscht"
    }
  },
  "admin": {
    "users": {
      "title": "Benutzer",
      "displayName": "Name",
      "email": "E-Mail",
      "role": "Rolle",
      "verified": "Bestätigt",
      "status": "Status",
      "createdAt": "Erstellt",
      "active": "Aktiv",
      "disabled": "Deaktiviert",
      "disable": "Deaktivieren",
      "enable": "Aktivieren",
      "roleChanged": "Rolle aktualisiert",
      "statusChanged": "Status aktualisiert",
      "self": "du"
    }
  },
  "legal": {
    "imprint": {
      "title": "Impressum",
      "body": "Platzhalter — durch dein Impressum ersetzen (§ 5 DDG): Name, Anschrift, Kontakt sowie ggf. Registereinträge und USt-IdNr."
    },
    "privacy": {
      "title": "Datenschutzerklärung",
      "body": "Platzhalter — durch deine Datenschutzerklärung ersetzen (DSGVO Art. 13/14): Verantwortlicher, Zwecke, Rechtsgrundlagen, Speicherdauer, Empfänger und Betroffenenrechte."
    }
  },
  "notFound": {
    "title": "Seite nicht gefunden",
    "body": "Die gesuchte Seite existiert nicht.",
    "home": "Zur Startseite"
  }
}
```

- [ ] **Step 5: Wire providers in app.config.ts**

Full new content of `apps/frontend/src/app/app.config.ts`:

```typescript
import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { LanguageService } from './core/i18n/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    // Order matters: on response errors the chain unwinds inside-out, so
    // authInterceptor (last) retries 401s with a refreshed token before
    // httpErrorInterceptor (first) would toast them.
    provideHttpClient(withInterceptors([httpErrorInterceptor, authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['en', 'de'],
        defaultLang: 'en',
        fallbackLang: 'en',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ],
};
```

- [ ] **Step 6: Create the spec test helper**

`apps/frontend/src/app/core/i18n/transloco-testing.ts`:

```typescript
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';

// Preloads the real English translations synchronously so component specs
// can keep asserting on visible copy. Import into TestBed `imports`.
export const getTranslocoTestingModule = () =>
  TranslocoTestingModule.forRoot({
    langs: { en },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });
```

Update `apps/frontend/tsconfig.spec.json`: add `"resolveJsonModule": true` to `compilerOptions` (needed for the JSON import above) AND add the helper to `include` — it is neither a `*.spec.ts` nor part of the app build, and eslint's typed linting rejects files that belong to no tsconfig:

```json
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "resolveJsonModule": true,
    "types": ["jest", "node"]
  },
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts",
    "src/app/core/i18n/transloco-testing.ts"
  ]
```

If `npx nx lint frontend` still flags `transloco-testing.ts` as outside every project, move the `include` entry to whichever tsconfig the error names — the goal is simply that exactly one tsconfig owns the file.

- [ ] **Step 7: Migrate the toolbar to transloco + add the language toggle**

`apps/frontend/src/app/app.component.ts` — full new content:

```typescript
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from './core/auth/auth.service';
import { LanguageService } from './core/i18n/language.service';
import { ROUTES } from './core/constants/routes.constants';

@Component({
  imports: [RouterModule, MatButtonModule, MatToolbarModule, TranslocoPipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly ROUTES = ROUTES;
}
```

`apps/frontend/src/app/app.component.html` — full new content. **Keep the `user-email` class — Cypress asserts on it.** (Footer links come in Task 4, settings/admin links in Tasks 12/14.)

```html
<mat-toolbar class="app-toolbar">
  <a class="app-title" [routerLink]="['/']">{{ 'nav.title' | transloco }}</a>
  <span class="toolbar-spacer"></span>
  <button mat-button type="button" class="lang-toggle" (click)="language.toggle()">{{ language.active() === 'en' ? 'DE' : 'EN' }}</button>
  @if (auth.isLoggedIn()) {
  <span class="user-email">{{ auth.currentUser()?.email }}</span>
  <button mat-button (click)="auth.logout()">{{ 'nav.logout' | transloco }}</button>
  } @else {
  <a mat-button [routerLink]="['/', ROUTES.LOGIN]">{{ 'nav.login' | transloco }}</a>
  }
</mat-toolbar>

<router-outlet></router-outlet>
```

- [ ] **Step 8: Fix the app spec**

In `apps/frontend/src/app/app.component.spec.ts`, add the testing module to the TestBed imports (adapt to the existing structure — the shape is):

```typescript
import { getTranslocoTestingModule } from './core/i18n/transloco-testing';
// inside TestBed.configureTestingModule:
imports: [App, getTranslocoTestingModule()],
```

If the spec asserts toolbar text, the assertions keep working (English is preloaded).

- [ ] **Step 9: Verify**

```bash
npx nx test frontend
npx nx build frontend
```

Expected: PASS / build succeeds. Quick manual sanity (optional): `npm run serve:all`, open :4200, click the DE/EN toggle — toolbar labels switch, choice survives reload.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(frontend): transloco i18n wiring with en/de translations and language toggle"
```

---

### Task 3: Extract existing UI strings to transloco (auth pages + example slice)

**Files:**

- Modify: `apps/frontend/src/app/components/auth/login/login.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/auth/register/register.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/auth/forgot-password/forgot-password.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/auth/reset-password/reset-password.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/auth/verify-email/verify-email.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/example/example.component.{ts,html}`
- Modify: `apps/frontend/src/app/components/example/example-edit-dialog/example-edit-dialog.component.{ts,html}`
- Modify: the corresponding `*.spec.ts` files (add `getTranslocoTestingModule()`)

**Interfaces:**

- Consumes: keys from `en.json`/`de.json` (Task 2) — the JSON files are complete; if a template contains a literal string with no matching key, STOP: that is a plan gap, add the key to BOTH json files and note the deviation.
- Produces: no API changes. Every `.ts` whose template uses the `transloco` pipe adds `TranslocoPipe` to its `imports` array. Toast calls translate via `TranslocoService.translate(key)`.

**Mechanical rule for every template:** replace each hardcoded English string with `{{ 'key' | transloco }}` where the key's `en` value is EXACTLY the old string. Result: rendered English output is byte-identical, so Cypress and existing spec assertions keep passing.

- [ ] **Step 1: Migrate login.component (worked example — the pattern for all others)**

`login.component.ts`: add to imports array `TranslocoPipe` with `import { TranslocoPipe } from '@jsverse/transloco';` — no other TS changes.

`login.component.html` — full new content:

```html
<div class="auth-page">
  <mat-card class="auth-card">
    <mat-card-header>
      <mat-card-title>{{ 'auth.login.title' | transloco }}</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <form class="auth-form" [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.email' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" />
          @if (form.get('email')?.hasError('required')) {
          <mat-error>{{ 'common.emailRequired' | transloco }}</mat-error>
          } @if (form.get('email')?.hasError('email')) {
          <mat-error>{{ 'common.emailInvalid' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.password' | transloco }}</mat-label>
          <input matInput type="password" formControlName="password" />
          @if (form.get('password')?.hasError('required')) {
          <mat-error>{{ 'common.passwordRequired' | transloco }}</mat-error>
          }
        </mat-form-field>

        <button mat-raised-button color="primary" type="submit" [disabled]="!form.valid || submitting()">{{ 'auth.login.submit' | transloco }}</button>
      </form>

      @if (unverifiedEmail()) {
      <p class="unverified-hint">
        {{ 'auth.login.unverifiedHint' | transloco }} @if (!resendRequested()) {
        <button mat-button type="button" (click)="resendVerification()">{{ 'auth.login.resend' | transloco }}</button>
        } @else { {{ 'auth.login.resendSent' | transloco }} }
      </p>
      }

      <div class="auth-links">
        <a [routerLink]="['/', ROUTES.FORGOT_PASSWORD]">{{ 'auth.login.forgotLink' | transloco }}</a>
        <a [routerLink]="['/', ROUTES.REGISTER]">{{ 'auth.login.registerLink' | transloco }}</a>
      </div>
    </mat-card-content>
  </mat-card>
</div>
```

- [ ] **Step 2: Migrate the remaining auth templates the same way**

Apply the identical mechanical rule. Key map (template string → key):

| Component           | old string                                                                                  | key                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| register            | `Create account` (title + submit)                                                           | `auth.register.title` / `auth.register.submit`                                   |
| register            | `Confirm password`                                                                          | `auth.register.confirmPassword`                                                  |
| register            | `Passwords do not match`                                                                    | `common.passwordMismatch`                                                        |
| register            | `At least 8 characters`                                                                     | `common.passwordMinLength`                                                       |
| register            | `Already have an account? Login`                                                            | `auth.register.loginLink`                                                        |
| register            | `Check your inbox`                                                                          | `auth.register.inboxTitle`                                                       |
| register            | `We sent a verification link to` / `. Click it to activate your account.`                   | `auth.register.inboxBody` / `auth.register.inboxBodySuffix`                      |
| register            | `Resend mail`                                                                               | `auth.register.resend`                                                           |
| forgot-password     | `Forgot password`                                                                           | `auth.forgot.title`                                                              |
| forgot-password     | `If an account exists for that email, …`                                                    | `auth.forgot.sent`                                                               |
| forgot-password     | `Send reset link`                                                                           | `auth.forgot.submit`                                                             |
| forgot/reset/verify | `Back to login`                                                                             | `common.backToLogin`                                                             |
| reset-password      | `Reset password`                                                                            | `auth.reset.title`                                                               |
| reset-password      | `This link is missing its reset token. Request a new one via` + link `forgot password`      | `auth.reset.missingToken` + `auth.reset.missingTokenLink`                        |
| reset-password      | `New password` / `Confirm new password` / `Set new password`                                | `auth.reset.newPassword` / `auth.reset.confirmNewPassword` / `auth.reset.submit` |
| verify-email        | `Verifying…` / `Checking your verification link.`                                           | `auth.verify.verifyingTitle` / `auth.verify.verifyingBody`                       |
| verify-email        | `Link invalid or expired`                                                                   | `auth.verify.failedTitle`                                                        |
| verify-email        | `Request a fresh verification mail:`                                                        | `auth.verify.resendPrompt`                                                       |
| verify-email        | `Resend verification mail`                                                                  | `auth.verify.resend`                                                             |
| verify-email        | `If that address has an unverified account, a mail is on its way.`                          | `auth.verify.resendSent`                                                         |
| all                 | `Email` / `Password` / `Email is required` / `Enter a valid email` / `Password is required` | `common.*`                                                                       |

The register inbox paragraph becomes:

```html
<p>
  {{ 'auth.register.inboxBody' | transloco }}
  <strong>{{ submittedEmail() }}</strong>{{ 'auth.register.inboxBodySuffix' | transloco }}
</p>
```

Each `.ts` gets `TranslocoPipe` in its `imports` array.

- [ ] **Step 3: Migrate the example slice**

`example.component.html`: same rule with the `example.*` keys (`title`, `addTitle`, `name`, `namePlaceholder` for the input `placeholder` attribute — use `[placeholder]="'example.namePlaceholder' | transloco"`, `nameRequired`, `type`, `typeRequired`, `createdAt`, `actions`, `add`, `noData`; the `matTooltip` attributes become `[matTooltip]="'example.edit' | transloco"` / `[matTooltip]="'example.delete' | transloco"`).

`example.component.ts`: add `TranslocoPipe` to imports AND inject the service for toasts/confirm:

```typescript
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
// in the class:
private transloco = inject(TranslocoService);
```

Replace the three literals:

```typescript
this.toast.success(this.transloco.translate('example.created'));
// ...
if (confirm(this.transloco.translate('example.confirmDelete'))) {
// ...
this.toast.success(this.transloco.translate('example.deleted'));
```

`example-edit-dialog.component.html`: read the file first; replace its literals with keys following the same rule. Expected strings are a dialog title, Name/Type labels and Save/Cancel buttons — if a string has no key in `example.*`/`common.*`, add a key to BOTH json files (e.g. `example.editTitle`, `example.save`, `example.cancel`) and note the deviation in the commit body.

- [ ] **Step 4: Add the transloco testing module to all touched specs**

In `login.component.spec.ts`, `register.component.spec.ts`, `verify-email.component.spec.ts`, `example.component.spec.ts`, `example-edit-dialog.component.spec.ts`: add `getTranslocoTestingModule()` to the TestBed `imports` array:

```typescript
import { getTranslocoTestingModule } from '../../../core/i18n/transloco-testing';
```

(Adjust the relative path per file depth: components/auth/\* → `../../../core/i18n/transloco-testing`; components/example → `../../core/i18n/transloco-testing`; example-edit-dialog → `../../../core/i18n/transloco-testing`.)

- [ ] **Step 5: Verify — unit AND e2e (rendered English must be unchanged)**

```bash
npx nx test frontend
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
```

Expected: all frontend specs pass; all Cypress specs pass unchanged (the extraction is invisible in English).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(frontend): extract auth and example UI strings to transloco"
```

---

### Task 4: Legal pages (Imprint/Privacy), 404 page, footer

**Files:**

- Create: `apps/frontend/src/app/components/legal/imprint.component.ts`
- Create: `apps/frontend/src/app/components/legal/privacy.component.ts`
- Create: `apps/frontend/src/app/components/legal/index.ts`
- Create: `apps/frontend/src/app/components/not-found/not-found.component.ts`
- Create: `apps/frontend/src/app/components/not-found/not-found.component.spec.ts`
- Modify: `apps/frontend/src/app/core/constants/routes.constants.ts`
- Modify: `apps/frontend/src/app/app.routes.ts`
- Modify: `apps/frontend/src/app/app.component.html`
- Modify: `apps/frontend/src/app/app.component.scss`

**Interfaces:**

- Consumes: `legal.*`, `notFound.*`, `footer.*` keys (Task 2); `ROUTES` constant object.
- Produces: `ROUTES.IMPRINT = 'imprint'`, `ROUTES.PRIVACY = 'privacy'` (Task 8's register checkbox links to PRIVACY). Wildcard route now renders `NotFoundComponent`; the root path gets an EXPLICIT redirect to examples (previously `**` did that job — several e2e tests visit `/`).

- [ ] **Step 1: Route constants**

Add to the `ROUTES` object in `apps/frontend/src/app/core/constants/routes.constants.ts`:

```typescript
  IMPRINT: 'imprint',
  PRIVACY: 'privacy',
```

- [ ] **Step 2: Legal components (single-file components, inline template)**

`apps/frontend/src/app/components/legal/imprint.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

// Placeholder page — downstream projects MUST replace the body with their
// real Impressum (legally required in Germany, § 5 DDG). Content lives in
// i18n/{en,de}.json under legal.imprint.
@Component({
  selector: 'app-imprint',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legal-page">
      <h1>{{ 'legal.imprint.title' | transloco }}</h1>
      <p>{{ 'legal.imprint.body' | transloco }}</p>
    </div>
  `,
  styles: `
    .legal-page {
      max-width: 48rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
  `,
})
export class ImprintComponent {}
```

`apps/frontend/src/app/components/legal/privacy.component.ts` — identical shape with selector `app-privacy`, class `PrivacyComponent`, keys `legal.privacy.title` / `legal.privacy.body`, and the comment referencing GDPR Art. 13/14 instead of § 5 DDG.

`apps/frontend/src/app/components/legal/index.ts`:

```typescript
export * from './imprint.component';
export * from './privacy.component';
```

- [ ] **Step 3: 404 component + spec**

`apps/frontend/src/app/components/not-found/not-found.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="not-found-page">
      <h1>{{ 'notFound.title' | transloco }}</h1>
      <p>{{ 'notFound.body' | transloco }}</p>
      <a mat-raised-button color="primary" [routerLink]="['/']">
        {{ 'notFound.home' | transloco }}
      </a>
    </div>
  `,
  styles: `
    .not-found-page {
      text-align: center;
      margin-top: 4rem;
    }
  `,
})
export class NotFoundComponent {}
```

`apps/frontend/src/app/components/not-found/not-found.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotFoundComponent } from './not-found.component';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';

describe('NotFoundComponent', () => {
  it('renders the not-found message with a home link', async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, getTranslocoTestingModule()],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Page not found');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
```

- [ ] **Step 4: Routes — explicit root redirect + wildcard 404**

In `apps/frontend/src/app/app.routes.ts`: add imports

```typescript
import { ImprintComponent, PrivacyComponent } from './components/legal';
import { NotFoundComponent } from './components/not-found/not-found.component';
```

Add BEFORE the `'**'` entry:

```typescript
  {
    path: ROUTES.IMPRINT,
    component: ImprintComponent,
  },
  {
    path: ROUTES.PRIVACY,
    component: PrivacyComponent,
  },
  {
    // The old '**' redirect doubled as the root route — keep '/' working
    // now that '**' renders a real 404.
    path: '',
    redirectTo: ROUTES.EXAMPLES,
    pathMatch: 'full',
  },
```

and REPLACE the wildcard entry:

```typescript
  {
    path: '**',
    component: NotFoundComponent,
  },
```

- [ ] **Step 5: Footer**

Append to `apps/frontend/src/app/app.component.html` (after `<router-outlet></router-outlet>`):

```html
<footer class="app-footer">
  <a [routerLink]="['/', ROUTES.IMPRINT]">{{ 'footer.imprint' | transloco }}</a>
  <a [routerLink]="['/', ROUTES.PRIVACY]">{{ 'footer.privacy' | transloco }}</a>
</footer>
```

Append to `apps/frontend/src/app/app.component.scss`:

```scss
.app-footer {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  padding: 1rem;
  font-size: 0.85rem;

  a {
    color: inherit;
    opacity: 0.7;
    text-decoration: none;

    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
}
```

- [ ] **Step 6: Verify**

```bash
npx nx test frontend && npx nx build frontend
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
```

Expected: all pass (e2e proves `/` still lands on examples). Manual sanity: `/imprint`, `/privacy`, `/definitely-not-a-page` (404), footer links present.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): legal placeholder pages, 404 page, footer"
```

---

### Task 5: Pagination convention — shared types + API (example slice becomes the reference)

**Files:**

- Create: `libs/shared/src/lib/models/page.model.ts`
- Modify: `libs/shared/src/lib/models/index.ts`
- Create: `apps/api/src/common/pagination/page-query.dto.ts`
- Create: `apps/api/src/common/pagination/pagination.util.ts`
- Create: `apps/api/src/common/pagination/pagination.util.spec.ts`
- Modify: `apps/api/src/app/example/example.service.ts`
- Modify: `apps/api/src/app/example/example.controller.ts`
- Modify: `apps/api/src/app/example/example.service.spec.ts`
- Modify: `apps/api/src/app/example/example.controller.spec.ts`

**Interfaces:**

- Consumes: global `ValidationPipe({ whitelist: true, transform: true })` (already set in `apps/api/src/main.ts`) — makes `@Type(() => Number)` work on query params.
- Produces (used by Tasks 6, 13, 14):
  - `PageRequest { page: number; pageSize: number; sort?: string; order?: 'asc' | 'desc' }`
  - `PageResponse<T> { items: T[]; total: number; page: number; pageSize: number }`
  - `PageQueryDto` (class, defaults page=1 pageSize=20, max pageSize 100)
  - `pageOffset(query): number`, `toPageResponse<T>(items, total, query): PageResponse<T>`, `resolveSort(columns, sort, fallback): string`
  - `ExampleService.findAll(query: PageRequest): Promise<PageResponse<Example>>`, `GET /api/examples?page=&pageSize=&sort=&order=`

- [ ] **Step 1: Shared types**

`libs/shared/src/lib/models/page.model.ts`:

```typescript
// The list-endpoint convention: FE sends PageRequest params, API answers
// PageResponse. page is 1-based. sort keys are camelCase model fields the
// endpoint explicitly whitelists (see resolveSort in the API).
export interface PageRequest {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Add to `libs/shared/src/lib/models/index.ts`:

```typescript
export * from './page.model';
```

- [ ] **Step 2: Write the failing util spec (TDD)**

`apps/api/src/common/pagination/pagination.util.spec.ts`:

```typescript
import { pageOffset, resolveSort, toPageResponse } from './pagination.util';

describe('pagination utils', () => {
  it('computes offsets from 1-based pages', () => {
    expect(pageOffset({ page: 1, pageSize: 20 })).toBe(0);
    expect(pageOffset({ page: 3, pageSize: 10 })).toBe(20);
  });

  it('wraps items in a page response', () => {
    expect(toPageResponse(['a'], 41, { page: 2, pageSize: 20 })).toEqual({
      items: ['a'],
      total: 41,
      page: 2,
      pageSize: 20,
    });
  });

  it('resolves sort keys against the whitelist only', () => {
    const columns = { createdAt: 'created_at' };
    expect(resolveSort(columns, 'createdAt', 'name')).toBe('created_at');
    expect(resolveSort(columns, 'evil; drop table', 'name')).toBe('name');
    expect(resolveSort(columns, undefined, 'name')).toBe('name');
  });
});
```

Run: `npx nx test api` — expected: FAIL (module not found).

- [ ] **Step 3: Implement the utils + DTO**

`apps/api/src/common/pagination/pagination.util.ts`:

```typescript
import { PageRequest, PageResponse } from '@arvid-l-monorepo-template/shared';

export const pageOffset = (query: Pick<PageRequest, 'page' | 'pageSize'>): number => (query.page - 1) * query.pageSize;

export const toPageResponse = <T>(items: T[], total: number, query: Pick<PageRequest, 'page' | 'pageSize'>): PageResponse<T> => ({
  items,
  total,
  page: query.page,
  pageSize: query.pageSize,
});

// Maps a client-provided camelCase sort key to a real column name via an
// endpoint-owned whitelist. NEVER feed raw client input into orderBy —
// this is the injection guard.
export const resolveSort = (columns: Record<string, string>, sort: string | undefined, fallback: string): string => (sort && columns[sort]) || fallback;
```

`apps/api/src/common/pagination/page-query.dto.ts`:

```typescript
import { PageRequest } from '@arvid-l-monorepo-template/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Query-param DTO for every paginated list endpoint. The global
// ValidationPipe has transform: true, so @Type coerces the strings.
export class PageQueryDto implements PageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 20;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsIn(['asc', 'desc'])
  @IsOptional()
  order?: 'asc' | 'desc';
}
```

Run: `npx nx test api` — expected: pagination utils PASS.

- [ ] **Step 4: Paginate the example endpoint**

`apps/api/src/app/example/example.service.ts` — add imports:

```typescript
import { sql } from 'kysely';
import { PageRequest, PageResponse } from '@arvid-l-monorepo-template/shared';
import { pageOffset, resolveSort, toPageResponse } from '../../common/pagination/pagination.util';
```

Add the whitelist above the class:

```typescript
// Sortable columns for GET /examples — camelCase key as the client sends
// it, snake_case value as the DB knows it.
const EXAMPLE_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  type: 'type',
  createdAt: 'created_at',
};
```

Replace `findAll()` with:

```typescript
  async findAll(query: PageRequest): Promise<PageResponse<Example>> {
    const sortColumn = resolveSort(EXAMPLE_SORT_COLUMNS, query.sort, 'created_at');
    const order = query.order ?? 'desc';

    const [rows, countRow] = await Promise.all([
      this.db
        .selectFrom('examples')
        .selectAll()
        .where('deleted_at', 'is', null)
        .orderBy(sql.ref(sortColumn), order)
        .limit(query.pageSize)
        .offset(pageOffset(query))
        .execute(),
      this.db
        .selectFrom('examples')
        .select(({ fn }) => fn.countAll<string>().as('total'))
        .where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow(),
    ]);

    return toPageResponse(
      rows.map(this.tableToModel),
      Number(countRow.total),
      query,
    );
  }
```

`apps/api/src/app/example/example.controller.ts` — change the list route:

```typescript
import { Query } from '@nestjs/common'; // add to the existing import list
import { PageResponse } from '@arvid-l-monorepo-template/shared'; // extend existing import
import { PageQueryDto } from '../../common/pagination/page-query.dto';
```

```typescript
  @Get()
  async findAll(@Query() query: PageQueryDto): Promise<PageResponse<Example>> {
    return this.exampleService.findAll(query);
  }
```

- [ ] **Step 5: Update the example specs**

In `apps/api/src/app/example/example.service.spec.ts`, replace the whole `describe('findAll', …)` block with:

```typescript
describe('findAll', () => {
  const query = { page: 1, pageSize: 20 };

  const listBuilder = () => ({
    selectAll: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([mockExampleTable]),
  });
  const countBuilder = (total: string) => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    executeTakeFirstOrThrow: jest.fn().mockResolvedValue({ total }),
  });

  it('returns a page of examples with the total count', async () => {
    const list = listBuilder();
    mockDb.selectFrom.mockReturnValueOnce(list).mockReturnValueOnce(countBuilder('41'));

    const result = await service.findAll(query);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Test Example');
    expect(result.total).toBe(41);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(list.limit).toHaveBeenCalledWith(20);
    expect(list.offset).toHaveBeenCalledWith(0);
  });

  it('offsets later pages', async () => {
    const list = listBuilder();
    mockDb.selectFrom.mockReturnValueOnce(list).mockReturnValueOnce(countBuilder('41'));

    await service.findAll({ page: 3, pageSize: 10 });

    expect(list.offset).toHaveBeenCalledWith(20);
  });
});
```

In `apps/api/src/app/example/example.controller.spec.ts`, replace the `describe('findAll', …)` block with:

```typescript
describe('findAll', () => {
  it('passes the page query through and returns the page', async () => {
    const page = {
      items: [mockExample],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    mockExampleService.findAll.mockResolvedValue(page);
    const query = { page: 1, pageSize: 20 };

    const result = await controller.findAll(query);

    expect(result).toEqual(page);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx nx test api
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): pagination convention (PageRequest/PageResponse) on the example slice"
```

---

### Task 6: Pagination — frontend (example table gets a MatPaginator)

**Files:**

- Modify: `apps/frontend/src/app/core/api/example.api.service.ts`
- Modify: `apps/frontend/src/app/core/api/example.api.service.spec.ts`
- Modify: `apps/frontend/src/app/components/example/example.component.ts`
- Modify: `apps/frontend/src/app/components/example/example.component.html`
- Modify: `apps/frontend/src/app/components/example/example.component.spec.ts`

**Interfaces:**

- Consumes: `PageRequest`/`PageResponse` (Task 5), `GET /api/examples` paginated shape.
- Produces: `ExampleApiService.getAll(request?: Partial<PageRequest>): Observable<PageResponse<Example>>` — the FE-side list convention Task 14's admin page copies.

- [ ] **Step 1: API service**

Replace `getAll` in `apps/frontend/src/app/core/api/example.api.service.ts` (add `HttpParams` to the `@angular/common/http` import and `PageRequest`, `PageResponse` to the shared import):

```typescript
  getAll(request: Partial<PageRequest> = {}): Observable<PageResponse<Example>> {
    let params = new HttpParams()
      .set('page', request.page ?? 1)
      .set('pageSize', request.pageSize ?? 10);
    if (request.sort) {
      params = params.set('sort', request.sort);
    }
    if (request.order) {
      params = params.set('order', request.order);
    }
    return this.http.get<PageResponse<Example>>(this.apiUrl, { params });
  }
```

- [ ] **Step 2: Component state + paginator**

`apps/frontend/src/app/components/example/example.component.ts` changes:

Add imports:

```typescript
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
```

Add `MatPaginatorModule` to the component `imports` array.

Replace the `examples` signal and `loadExamples` with:

```typescript
  readonly examples = signal<Example[]>([]);
  readonly total = signal(0);
  // MatPaginator is 0-based; the API convention is 1-based.
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  loadExamples(): void {
    this.exampleApiService
      .getAll({ page: this.pageIndex() + 1, pageSize: this.pageSize() })
      .subscribe({
        next: (page) => {
          this.examples.set(page.items);
          this.total.set(page.total);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => undefined,
      });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadExamples();
  }
```

(`onSubmit`/`onDelete` keep calling `loadExamples()` — unchanged.)

- [ ] **Step 3: Template**

In `apps/frontend/src/app/components/example/example.component.html`, directly after the closing `</table>` tag insert:

```html
<mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[5, 10, 25]" (page)="onPage($event)" />
```

- [ ] **Step 4: Update specs**

`example.api.service.spec.ts`: the `getAll` test now expects a paginated request/response. Update the existing `getAll` test to:

```typescript
it('getAll requests a page and returns it', () => {
  const page = { items: [], total: 0, page: 1, pageSize: 10 };

  service.getAll({ page: 1, pageSize: 10 }).subscribe((result) => {
    expect(result).toEqual(page);
  });

  const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/examples` && r.params.get('page') === '1' && r.params.get('pageSize') === '10');
  expect(req.request.method).toBe('GET');
  req.flush(page);
});
```

(Adapt variable names — `httpMock`/`service` — to what the existing spec file uses.)

`example.component.spec.ts`: wherever the mocked `ExampleApiService.getAll` returns `of([mockExample])` or similar, change it to return a page:

```typescript
of({ items: [mockExample], total: 1, page: 1, pageSize: 10 });
```

and if the spec asserts `component.examples()`, that still works (items land in the same signal).

- [ ] **Step 5: Verify — unit + e2e**

```bash
npx nx test frontend
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
```

Expected: PASS. `app.cy.ts` creates an example and finds it in the table — default sort `created_at desc` puts new rows on page 1, so it must keep passing. If it fails, debug the API response shape first (`curl 'http://localhost:3000/api/examples?page=1&pageSize=5'`).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): paginated example table (MatPaginator + PageResponse)"
```

---

### Task 7: display_name + privacy consent — API side (register, /auth/me from DB, PATCH /auth/profile)

⚠️ Pair with Task 8 — UI registration is broken between the two (API now requires `privacyAccepted`). No e2e run until Task 8 is done.

**Files:**

- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Modify: `apps/api/src/app/auth/users.service.ts`
- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Modify: `apps/api/src/app/auth/dto/register.dto.ts`
- Create: `apps/api/src/app/auth/dto/update-profile.dto.ts`
- Modify: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: `UserTable.display_name` / `privacy_accepted_at` (Task 1).
- Produces (Tasks 8–14 rely on these exact shapes):
  - `AuthUser` gains `displayName: string | null`
  - shared `RegisterDto { email; password; displayName?: string; privacyAccepted: boolean }`
  - shared `UpdateProfileDto { displayName: string }`
  - `UsersService.create(input: CreateUserInput): Promise<Selectable<UserTable>>` — **object param replaces the positional args**
  - `UsersService.updateDisplayName(id, name: string | null)`, `UsersService.updateEmail(id, email)` (used by Task 10)
  - `AuthService.register(dto: RegisterDto)`, `AuthService.me(userId): Promise<AuthUser>`, `AuthService.updateProfile(userId, displayName): Promise<AuthUser>`, private `toAuthUser(user)`
  - `PATCH /api/auth/profile` (JWT) → `AuthUser`

- [ ] **Step 1: Shared types**

In `libs/shared/src/lib/models/auth.model.ts`:

```typescript
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName?: string;
  // GDPR: registration requires explicit consent to the privacy policy.
  privacyAccepted: boolean;
}

export interface UpdateProfileDto {
  displayName: string;
}
```

(Leave the other interfaces untouched.)

- [ ] **Step 2: UsersService — object-style create + profile updates**

In `apps/api/src/app/auth/users.service.ts`, replace `create` with (and export the input type):

```typescript
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string | null;
  role?: UserRole;
  emailVerified?: boolean;
  privacyAccepted?: boolean;
}
```

```typescript
  async create(input: CreateUserInput): Promise<Selectable<UserTable>> {
    return this.db
      .insertInto('users')
      .values({
        email: input.email,
        password_hash: input.passwordHash,
        display_name: input.displayName ?? null,
        role: input.role ?? UserRole.USER,
        // Scripted/bootstrap users skip the verification mail round-trip.
        email_verified_at: input.emailVerified
          ? new Date().toISOString()
          : null,
        // Consent timestamp — proof of WHEN the checkbox was accepted.
        privacy_accepted_at: input.privacyAccepted
          ? new Date().toISOString()
          : null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
```

Add below `updatePassword`:

```typescript
  async updateDisplayName(id: string, displayName: string | null): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ display_name: displayName })
      .where('id', '=', id)
      .execute();
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ email })
      .where('id', '=', id)
      .execute();
  }
```

- [ ] **Step 3: AuthService — toAuthUser, register(dto), me, updateProfile**

In `apps/api/src/app/auth/auth.service.ts`:

Add `RegisterDto` to the shared import list. Add a private mapper next to `issueTokenPair` and use it EVERYWHERE a user row becomes an `AuthUser`:

```typescript
  private toAuthUser(user: {
    id: string;
    email: string;
    role: UserRole;
    display_name: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
    };
  }
```

Replace every `this.issueTokenPair({ id: user.id, email: user.email, role: user.role })` call (in `login`, `verifyEmail`, `refresh`) with:

```typescript
return this.issueTokenPair(this.toAuthUser(user));
```

Replace `register` signature and body start:

```typescript
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    try {
      const user = await this.usersService.create({
        email: dto.email,
        passwordHash: hashPassword(dto.password),
        displayName: dto.displayName || null,
        privacyAccepted: dto.privacyAccepted,
      });
      await this.sendVerificationMail(user.id, user.email);
      return { message: 'Check your inbox to verify your email address' };
    } catch (error) {
      // Race-safe duplicate check: rely on the unique index instead of a
      // separate SELECT beforehand.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
```

Add the two new methods:

```typescript
  // /auth/me reads from the DB (not the JWT) so displayName and future
  // profile fields are always fresh.
  async me(userId: string): Promise<AuthUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.toAuthUser(user);
  }

  async updateProfile(userId: string, displayName: string): Promise<AuthUser> {
    // Empty submissions clear the name — the UI falls back to the email.
    await this.usersService.updateDisplayName(userId, displayName.trim() || null);
    return this.me(userId);
  }
```

- [ ] **Step 4: DTO classes**

`apps/api/src/app/auth/dto/register.dto.ts` — full new content:

```typescript
import { RegisterDto as SharedRegisterDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements SharedRegisterDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  // GDPR: consent must be an explicit action — the API refuses without it.
  @Equals(true)
  privacyAccepted!: boolean;
}
```

Create `apps/api/src/app/auth/dto/update-profile.dto.ts`:

```typescript
import { UpdateProfileDto as SharedUpdateProfileDto } from '@arvid-l-monorepo-template/shared';
import { IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto implements SharedUpdateProfileDto {
  // Empty string is allowed — it clears the display name.
  @IsString()
  @MaxLength(120)
  displayName!: string;
}
```

- [ ] **Step 5: Controller**

In `apps/api/src/app/auth/auth.controller.ts`:

Add `Patch` to the `@nestjs/common` import; add `import { UpdateProfileDto } from './dto/update-profile.dto';`.

`register` passes the whole dto:

```typescript
  @Post('register')
  @Throttle(CREDENTIAL_THROTTLE)
  async register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
    return this.authService.register(registerDto);
  }
```

`me` becomes a DB read:

```typescript
  // Protected example — the pattern to copy for any secured endpoint.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<AuthUser> {
    return this.authService.me(user.sub);
  }
```

New endpoint after `me`:

```typescript
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUser> {
    return this.authService.updateProfile(user.sub, dto.displayName);
  }
```

- [ ] **Step 6: Update auth.service.spec.ts**

In `apps/api/src/app/auth/auth.service.spec.ts`:

1. Extend `storedUser` with the new columns:

```typescript
const storedUser = {
  id: 'user-1',
  email: 'admin@example.org',
  password_hash: hashPassword('secret-password'),
  role: UserRole.ADMIN,
  email_verified_at: new Date().toISOString(),
  display_name: null,
  disabled_at: null,
  privacy_accepted_at: null,
};
```

2. Add the two new mocks to the `UsersService` useValue object:

```typescript
  const updateDisplayName = jest.fn();
  const updateEmail = jest.fn();
  // …in useValue:
  { findByEmail, findById, create, updatePassword, markEmailVerified, updateDisplayName, updateEmail },
```

3. Every `expect(result.user).toEqual({ id…, email…, role… })` assertion gains `displayName: null`.

4. Replace the register happy-path test's call + create assertion:

```typescript
const result = await service.register({
  email: 'new@example.org',
  password: 'password-123',
  displayName: 'New Person',
  privacyAccepted: true,
});

expect(create).toHaveBeenCalledWith({
  email: 'new@example.org',
  passwordHash: expect.stringMatching(/^scrypt\$/),
  displayName: 'New Person',
  privacyAccepted: true,
});
```

(Any other `service.register('mail', 'pw')` call sites in the spec become `service.register({ email: 'mail', password: 'pw', privacyAccepted: true })`.)

5. New describe blocks:

```typescript
describe('me', () => {
  it('returns the fresh user from the DB', async () => {
    findById.mockResolvedValue({ ...storedUser, display_name: 'Arvid' });

    await expect(service.me('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'admin@example.org',
      role: UserRole.ADMIN,
      displayName: 'Arvid',
    });
  });

  it('rejects unknown users', async () => {
    findById.mockResolvedValue(undefined);

    await expect(service.me('ghost')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('updateProfile', () => {
  it('trims the name and stores null for empty input', async () => {
    findById.mockResolvedValue(storedUser);

    await service.updateProfile('user-1', '   ');

    expect(updateDisplayName).toHaveBeenCalledWith('user-1', null);
  });

  it('stores the trimmed display name and returns the fresh user', async () => {
    findById.mockResolvedValue({ ...storedUser, display_name: 'Arvid' });

    const result = await service.updateProfile('user-1', '  Arvid ');

    expect(updateDisplayName).toHaveBeenCalledWith('user-1', 'Arvid');
    expect(result.displayName).toBe('Arvid');
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npx nx test api && npx nx test frontend && npx nx build api
```

Expected: api PASS. **frontend spec/build may fail where it constructs `RegisterDto` without `privacyAccepted`** — if so, that is Task 8's job; only fix compile errors here by adding `privacyAccepted: true` to FE test fixtures if needed to keep the workspace building, and note it.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(api): display name + privacy consent on registration, DB-backed /auth/me, PATCH /auth/profile"
```

---

### Task 8: Register form (display name + privacy checkbox) + toolbar shows display name + e2e update

**Files:**

- Modify: `apps/frontend/src/app/components/auth/register/register.component.ts`
- Modify: `apps/frontend/src/app/components/auth/register/register.component.html`
- Modify: `apps/frontend/src/app/components/auth/register/register.component.spec.ts`
- Modify: `apps/frontend/src/app/app.component.html`
- Modify: `apps/frontend-e2e/src/e2e/auth.cy.ts`

**Interfaces:**

- Consumes: shared `RegisterDto` with `displayName?`/`privacyAccepted` (Task 7), `ROUTES.PRIVACY` (Task 4), keys `auth.register.*` (Task 2).
- Produces: registration UI works against the stricter API again — e2e suite is green after this task.

- [ ] **Step 1: Component class**

`register.component.ts` — add imports:

```typescript
import { MatCheckboxModule } from '@angular/material/checkbox';
```

Add `MatCheckboxModule` to the `imports` array (`TranslocoPipe` is already there from Task 3).

Extend the form group (email/password/passwordConfirm stay unchanged):

```typescript
form: FormGroup = this.fb.group(
  {
    displayName: ['', Validators.maxLength(120)],
    email: ['', [Validators.required, Validators.email]],
    // Mirrors the API's MinLength(8) on RegisterDto
    password: ['', [Validators.required, Validators.minLength(8)]],
    passwordConfirm: ['', Validators.required],
    // Mirrors the API's Equals(true) — GDPR consent is mandatory.
    privacyAccepted: [false, Validators.requiredTrue],
  },
  { validators: passwordsMatch },
);
```

Update `onSubmit`:

```typescript
  onSubmit(): void {
    if (!this.form.valid) {
      return;
    }
    this.submitting.set(true);
    const { email, password, displayName, privacyAccepted } = this.form.value;
    this.auth
      .register({
        email,
        password,
        displayName: displayName || undefined,
        privacyAccepted,
      })
      .subscribe({
        next: () => {
          this.submittedEmail.set(email);
          this.registered.set(true);
        },
        // errors surface via the global httpErrorInterceptor toast
        error: () => this.submitting.set(false),
      });
  }
```

- [ ] **Step 2: Template**

In `register.component.html` (the Task-3 translated version):

Insert as the FIRST field inside the form, before the email field:

```html
<mat-form-field appearance="outline">
  <mat-label>{{ 'auth.register.displayName' | transloco }}</mat-label>
  <input matInput type="text" formControlName="displayName" />
</mat-form-field>
```

Insert between the confirm-password field and the submit button:

```html
<mat-checkbox formControlName="privacyAccepted" class="privacy-checkbox">
  {{ 'auth.register.privacyPrefix' | transloco }}
  <a [routerLink]="['/', ROUTES.PRIVACY]" target="_blank">{{ 'auth.register.privacyLinkLabel' | transloco }}</a>
</mat-checkbox>
```

(The submit button's `[disabled]="!form.valid || submitting()"` already blocks submission until the box is ticked.)

- [ ] **Step 3: Toolbar shows the display name**

In `apps/frontend/src/app/app.component.html`, change the user span (class MUST stay `user-email` — Cypress asserts `.user-email` contains the email, and e2e users have no display name, so they still render the email):

```html
<span class="user-email">{{ auth.currentUser()?.displayName || auth.currentUser()?.email }}</span>
```

- [ ] **Step 4: Update register.component.spec.ts**

Wherever the spec fills/submits the form, set the new controls too:

```typescript
component.form.setValue({
  displayName: '',
  email: 'new@example.org',
  password: 'password-123',
  passwordConfirm: 'password-123',
  privacyAccepted: true,
});
```

and where it asserts the register call:

```typescript
expect(registerSpy).toHaveBeenCalledWith({
  email: 'new@example.org',
  password: 'password-123',
  displayName: undefined,
  privacyAccepted: true,
});
```

Add one new test:

```typescript
it('keeps the form invalid until the privacy checkbox is accepted', () => {
  component.form.patchValue({
    email: 'new@example.org',
    password: 'password-123',
    passwordConfirm: 'password-123',
  });
  expect(component.form.valid).toBe(false);

  component.form.patchValue({ privacyAccepted: true });
  expect(component.form.valid).toBe(true);
});
```

(Adapt spy names to the existing spec structure.)

- [ ] **Step 5: Update auth.cy.ts — tick the checkbox in both register tests**

In `apps/frontend-e2e/src/e2e/auth.cy.ts`, in each test that clicks `Create account`, add BEFORE the submit click:

```typescript
cy.get('mat-checkbox').click();
```

- [ ] **Step 6: Verify — unit + full e2e**

```bash
npx nx test frontend && npx nx test api
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
```

Expected: everything green again (this closes the Task-7/8 breakage window).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(frontend): display name + privacy consent in registration, toolbar shows display name"
```

---

### Task 9: Change password — API

**Files:**

- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Create: `apps/api/src/app/auth/dto/change-password.dto.ts`
- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Modify: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: `verifyPassword`/`hashPassword` (`password.util.ts`), `RefreshTokensService.revokeAllForUser`, `toAuthUser` (Task 7).
- Produces: `POST /api/auth/change-password` (JWT, throttled) body `ChangePasswordDto { currentPassword, newPassword }` → 200 `LoginResponse` (fresh token pair; ALL old sessions revoked). Task 12's settings page consumes this.

- [ ] **Step 1: Shared type**

Add to `libs/shared/src/lib/models/auth.model.ts`:

```typescript
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `auth.service.spec.ts`:

```typescript
describe('changePassword', () => {
  it('rejects a wrong current password with 400 (NOT 401 — the FE interceptor would log the user out)', async () => {
    findById.mockResolvedValue(storedUser);

    await expect(service.changePassword('user-1', 'wrong', 'new-password-123')).rejects.toBeInstanceOf(BadRequestException);
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('updates the hash, revokes all sessions and returns a fresh pair', async () => {
    findById.mockResolvedValue(storedUser);

    const result = await service.changePassword('user-1', 'secret-password', 'new-password-123');

    expect(updatePassword).toHaveBeenCalledWith('user-1', expect.stringMatching(/^scrypt\$/));
    expect(revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(result.user.id).toBe('user-1');
  });
});
```

Run: `npx nx test api` — expected: FAIL (`changePassword is not a function`).

- [ ] **Step 3: Implement**

Add to `AuthService` (after `resetPassword`):

```typescript
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<LoginResponse> {
    const user = await this.usersService.findById(userId);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      // 400, not 401: a 401 would make the FE interceptor attempt a token
      // refresh and log the user out over a typo.
      throw new BadRequestException('Current password is incorrect');
    }

    await this.usersService.updatePassword(userId, hashPassword(newPassword));
    // Same reasoning as resetPassword: assume other sessions are stale or
    // hostile once the password changes — kill them, keep this one via a
    // fresh pair.
    await this.refreshTokensService.revokeAllForUser(userId);
    return this.issueTokenPair(this.toAuthUser(user));
  }
```

Create `apps/api/src/app/auth/dto/change-password.dto.ts`:

```typescript
import { ChangePasswordDto as SharedChangePasswordDto } from '@arvid-l-monorepo-template/shared';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto implements SharedChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

Add to `AuthController` (after `resend-verification`, import the dto):

```typescript
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(CREDENTIAL_THROTTLE)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<LoginResponse> {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
```

- [ ] **Step 4: Run tests, commit**

```bash
npx nx test api
git add -A && git commit -m "feat(api): change-password endpoint (revokes other sessions, returns fresh pair)"
```

---

### Task 10: Change email — API (verified via mail link to the NEW address)

**Files:**

- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Modify: `apps/api/src/app/auth/email-verification-tokens.service.ts`
- Create: `apps/api/src/app/auth/dto/change-email.dto.ts`
- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Modify: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: `email_verification_tokens.new_email` (Task 1), `UsersService.updateEmail` (Task 7), existing `/verify-email` endpoint + FE page (unchanged URLs — the mailed link is the same shape).
- Produces: `POST /api/auth/change-email` (JWT, throttled) body `ChangeEmailDto { newEmail, password }` → 204. `EmailVerificationTokensService.issue(userId, newEmail?)` gains an optional second param. `verifyEmail` handles both flavors of token.

**Flow:** request stores a token with `new_email` and mails the standard `/verify-email?token=…` link to the NEW address (clicking proves ownership) plus a heads-up notice to the OLD address. `verifyEmail` sees `new_email` set → swaps the email instead of marking first-time verification. The reissue rate limit (60s) responds silently, same contract as resend-verification.

- [ ] **Step 1: Shared type**

Add to `libs/shared/src/lib/models/auth.model.ts`:

```typescript
export interface ChangeEmailDto {
  newEmail: string;
  password: string;
}
```

- [ ] **Step 2: Token service takes an optional new_email**

In `email-verification-tokens.service.ts`, change `issue` signature and insert:

```typescript
  async issue(userId: string, newEmail?: string): Promise<string | null> {
```

and inside the `.values({ … })`:

```typescript
        user_id: userId,
        token_hash: this.hash(token),
        // Set for email-CHANGE tokens; null for first-time verification.
        new_email: newEmail ?? null,
        expires_at: new Date(
          Date.now() + VERIFICATION_TOKEN_TTL_MS,
        ).toISOString(),
```

- [ ] **Step 3: Write the failing tests**

Add to `auth.service.spec.ts` (uses existing mocks `issueVerification`, `findValidVerification`, `markUsedVerification`, `updateEmail`, `sendMail`):

```typescript
describe('changeEmail', () => {
  it('rejects a wrong password with 400', async () => {
    findById.mockResolvedValue(storedUser);

    await expect(service.changeEmail('user-1', 'new@example.org', 'wrong')).rejects.toBeInstanceOf(BadRequestException);
    expect(issueVerification).not.toHaveBeenCalled();
  });

  it('rejects an already-taken address with 409', async () => {
    findById.mockResolvedValue(storedUser);
    findByEmail.mockResolvedValue({ ...storedUser, id: 'someone-else' });

    await expect(service.changeEmail('user-1', 'taken@example.org', 'secret-password')).rejects.toBeInstanceOf(ConflictException);
  });

  it('issues a change token and mails the NEW address', async () => {
    findById.mockResolvedValue(storedUser);
    findByEmail.mockResolvedValue(undefined);
    issueVerification.mockResolvedValue('raw-change-token');
    sendMail.mockResolvedValue(undefined);

    await service.changeEmail('user-1', 'new@example.org', 'secret-password');

    expect(issueVerification).toHaveBeenCalledWith('user-1', 'new@example.org');
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new@example.org' }));
    // heads-up to the old address
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'admin@example.org' }));
  });

  it('stays silent when the reissue limit strikes', async () => {
    findById.mockResolvedValue(storedUser);
    findByEmail.mockResolvedValue(undefined);
    issueVerification.mockResolvedValue(null);

    await service.changeEmail('user-1', 'new@example.org', 'secret-password');

    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('verifyEmail with a change token', () => {
  it('swaps the email and returns a pair for the new identity', async () => {
    findValidVerification.mockResolvedValue({
      id: 'token-1',
      user_id: 'user-1',
      new_email: 'new@example.org',
    });
    findById.mockResolvedValue({ ...storedUser });
    updateEmail.mockResolvedValue(undefined);

    const result = await service.verifyEmail('raw-change-token');

    expect(updateEmail).toHaveBeenCalledWith('user-1', 'new@example.org');
    expect(markEmailVerified).not.toHaveBeenCalled();
    expect(markUsedVerification).toHaveBeenCalledWith('token-1');
    expect(result.user.email).toBe('new@example.org');
  });
});
```

Also update any EXISTING `verifyEmail` tests: their `findValidVerification.mockResolvedValue({ … })` fixtures need `new_email: null` so they keep exercising the first-time-verification branch.

Run: `npx nx test api` — expected: FAIL.

- [ ] **Step 4: Implement**

In `auth.service.ts`, replace the middle of `verifyEmail` (between the `user` lookup and `issueTokenPair`) with:

```typescript
if (stored.new_email) {
  // Email-change confirmation: the link went to the new address, so
  // clicking it proves ownership. The unique index has the final word —
  // the address may have been taken since the change was requested.
  try {
    await this.usersService.updateEmail(user.id, stored.new_email);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new BadRequestException('Email address is no longer available');
    }
    throw error;
  }
  user.email = stored.new_email;
} else {
  await this.usersService.markEmailVerified(user.id);
}
await this.emailVerificationTokensService.markUsed(stored.id);

// Clicking the mail link logs the user straight in.
return this.issueTokenPair(this.toAuthUser(user));
```

Add the new method (after `changePassword`):

```typescript
  async changeEmail(
    userId: string,
    newEmail: string,
    password: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !verifyPassword(password, user.password_hash)) {
      // 400, not 401 — see changePassword.
      throw new BadRequestException('Current password is incorrect');
    }
    if (newEmail === user.email) {
      throw new BadRequestException('This is already your email address');
    }
    if (await this.usersService.findByEmail(newEmail)) {
      // Enumeration is acceptable here: the caller is authenticated.
      throw new ConflictException('Email is already registered');
    }

    // null = reissued too soon — stay silent, same contract as resend.
    const token = await this.emailVerificationTokensService.issue(
      userId,
      newEmail,
    );
    if (!token) {
      return;
    }

    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'http://localhost:4200';
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    await this.mailService
      .send({
        to: newEmail,
        subject: 'Confirm your new email address',
        text:
          `Confirm this address to use it for your account ` +
          `(link valid for 24 hours):\n${verifyUrl}\n\n` +
          `If you didn't request this, ignore this mail.`,
      })
      .catch((error) =>
        this.logger.error(`Email change mail to ${newEmail} failed`, error),
      );

    // Best-effort heads-up to the old address: if the change wasn't
    // requested by the owner, they can still reset the password.
    await this.mailService
      .send({
        to: user.email,
        subject: 'Your email address is being changed',
        text:
          `A change of this account's email address to ${newEmail} was ` +
          `requested. If this wasn't you, reset your password immediately.`,
      })
      .catch((error) =>
        this.logger.error(`Email change notice to ${user.email} failed`, error),
      );
  }
```

Create `apps/api/src/app/auth/dto/change-email.dto.ts`:

```typescript
import { ChangeEmailDto as SharedChangeEmailDto } from '@arvid-l-monorepo-template/shared';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class ChangeEmailDto implements SharedChangeEmailDto {
  // Emails are stored and matched lowercase — normalize on the way in.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  newEmail!: string;

  @IsString()
  password!: string;
}
```

Add to `AuthController`:

```typescript
  // Always 204 once authenticated + password-checked: the reissue rate
  // limit responds identically (no token-timing signal).
  @Post('change-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle(CREDENTIAL_THROTTLE)
  async changeEmail(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    await this.authService.changeEmail(user.sub, dto.newEmail, dto.password);
  }
```

- [ ] **Step 5: Run tests, commit**

```bash
npx nx test api
git add -A && git commit -m "feat(api): change-email flow via verification link to the new address"
```

---

### Task 11: Delete account — API (hard delete, GDPR)

**Files:**

- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Create: `apps/api/src/app/auth/dto/delete-account.dto.ts`
- Modify: `apps/api/src/app/auth/users.service.ts`
- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Modify: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: FK `onDelete('cascade')` on refresh_tokens (migration 003), password_reset_tokens (005), email_verification_tokens (006) — verified, all three cascade, so one DELETE erases every token.
- Produces: `POST /api/auth/delete-account` (JWT, throttled) body `DeleteAccountDto { password }` → 204. `UsersService.deleteHard(id)`.

**Design note (do not "improve" this into a soft delete):** the users table has `deleted_at`, but soft-deleting an account would keep the email in the unique index — the person could never re-register, and the data would survive a GDPR erasure request. Account deletion is a REAL `DELETE`; the FK cascades take the tokens with it.

- [ ] **Step 1: Shared type**

```typescript
export interface DeleteAccountDto {
  password: string;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `auth.service.spec.ts` (add `const deleteHard = jest.fn();` to the mock list and `deleteHard` to the UsersService useValue):

```typescript
describe('deleteAccount', () => {
  it('rejects a wrong password with 400 and deletes nothing', async () => {
    findById.mockResolvedValue(storedUser);

    await expect(service.deleteAccount('user-1', 'wrong')).rejects.toBeInstanceOf(BadRequestException);
    expect(deleteHard).not.toHaveBeenCalled();
  });

  it('hard-deletes the user after password confirmation', async () => {
    findById.mockResolvedValue(storedUser);

    await service.deleteAccount('user-1', 'secret-password');

    expect(deleteHard).toHaveBeenCalledWith('user-1');
  });
});
```

Run: `npx nx test api` — expected: FAIL.

- [ ] **Step 3: Implement**

`users.service.ts`:

```typescript
  // Account deletion is a hard DELETE on purpose: soft delete would keep
  // the email in the unique index (blocks re-registration) and survive a
  // GDPR erasure request. Tokens die via FK cascade.
  async deleteHard(id: string): Promise<void> {
    await this.db.deleteFrom('users').where('id', '=', id).execute();
  }
```

`auth.service.ts` (after `changeEmail`):

```typescript
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !verifyPassword(password, user.password_hash)) {
      // 400, not 401 — see changePassword.
      throw new BadRequestException('Current password is incorrect');
    }
    await this.usersService.deleteHard(userId);
  }
```

`apps/api/src/app/auth/dto/delete-account.dto.ts`:

```typescript
import { DeleteAccountDto as SharedDeleteAccountDto } from '@arvid-l-monorepo-template/shared';
import { IsString } from 'class-validator';

export class DeleteAccountDto implements SharedDeleteAccountDto {
  @IsString()
  password!: string;
}
```

`auth.controller.ts`:

```typescript
  // POST (not DELETE): needs a body for the password confirmation.
  @Post('delete-account')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle(CREDENTIAL_THROTTLE)
  async deleteAccount(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.authService.deleteAccount(user.sub, dto.password);
  }
```

- [ ] **Step 4: Run tests, commit**

```bash
npx nx test api
git add -A && git commit -m "feat(api): delete-account endpoint (hard delete, GDPR erasure)"
```

---

### Task 12: Settings page (profile, change password, change email, delete account)

**Files:**

- Modify: `apps/frontend/src/app/core/auth/auth.api.service.ts`
- Modify: `apps/frontend/src/app/core/auth/auth.service.ts`
- Modify: `apps/frontend/src/app/core/constants/routes.constants.ts`
- Modify: `apps/frontend/src/app/app.routes.ts`
- Modify: `apps/frontend/src/app/app.component.html`
- Create: `apps/frontend/src/app/components/settings/settings.component.ts`
- Create: `apps/frontend/src/app/components/settings/settings.component.html`
- Create: `apps/frontend/src/app/components/settings/settings.component.spec.ts`

**Interfaces:**

- Consumes: Tasks 7/9/10/11 endpoints; `ToastService.success(msg)` (`core/services/toast.service.ts`); `authGuard`; keys `settings.*`.
- Produces: `ROUTES.SETTINGS = 'settings'`; `AuthApiService.{updateProfile,changePassword,changeEmail,deleteAccount}`; `AuthService.{updateProfile,deleteAccount}` (state-aware wrappers). The `form` elements carry classes `profile-form`, `password-form`, `email-form`, `delete-form` — Task 15's e2e selects on them.

- [ ] **Step 1: API service methods**

Add to `apps/frontend/src/app/core/auth/auth.api.service.ts` (extend the shared import with `AdminUser`-free additions: `ChangeEmailDto`, `ChangePasswordDto`, `DeleteAccountDto`, `UpdateProfileDto`):

```typescript
  updateProfile(data: UpdateProfileDto): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.apiUrl}/profile`, data);
  }

  // The API revokes all sessions and returns a fresh pair — store it so
  // THIS session survives the change.
  changePassword(data: ChangePasswordDto): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/change-password`, data)
      .pipe(tap((response) => this.storeTokens(response)));
  }

  changeEmail(data: ChangeEmailDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/change-email`, data);
  }

  deleteAccount(data: DeleteAccountDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/delete-account`, data);
  }
```

- [ ] **Step 2: State-aware wrappers in the FE AuthService**

Add to `apps/frontend/src/app/core/auth/auth.service.ts` (extend imports with `AuthUser` — already there — and `UpdateProfileDto` if desired; wrappers keep components off AuthApiService for anything that touches `currentUser`):

```typescript
  updateProfile(displayName: string): Observable<AuthUser> {
    return this.authApi
      .updateProfile({ displayName })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  deleteAccount(password: string): Observable<void> {
    return this.authApi.deleteAccount({ password }).pipe(
      tap(() => {
        // The account is gone — drop all local state, no server logout
        // (the tokens died with the user row).
        this.currentUser.set(null);
        this.tokenStorage.clear();
        this.router.navigate(['/']);
      }),
    );
  }
```

- [ ] **Step 3: Route + toolbar link**

`routes.constants.ts`: add `SETTINGS: 'settings',`

`app.routes.ts`: add (import `SettingsComponent` and `authGuard` — `import { authGuard } from './core/auth/auth.guard';`):

```typescript
  {
    path: ROUTES.SETTINGS,
    component: SettingsComponent,
    canActivate: [authGuard],
  },
```

`app.component.html`: inside the `@if (auth.isLoggedIn())` block, BEFORE the user-email span:

```html
<a mat-button [routerLink]="['/', ROUTES.SETTINGS]">{{ 'nav.settings' | transloco }}</a>
```

- [ ] **Step 4: Settings component**

`apps/frontend/src/app/components/settings/settings.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AuthApiService } from '../../core/auth/auth.api.service';
import { ToastService } from '../../core/services/toast.service';

// Cross-field validator: newPasswordConfirm must match newPassword.
const passwordsMatch = (group: AbstractControl): ValidationErrors | null => (group.get('newPassword')?.value === group.get('newPasswordConfirm')?.value ? null : { passwordMismatch: true });

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, TranslocoPipe],
  templateUrl: './settings.component.html',
  styles: `
    .settings-page {
      max-width: 32rem;
      margin: 2rem auto;
      padding: 0 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .settings-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .danger-title {
      color: var(--mat-sys-error, #b3261e);
    }
  `,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly savingProfile = signal(false);
  readonly changingPassword = signal(false);
  readonly changingEmail = signal(false);
  readonly deleting = signal(false);
  // Set once a change-email verification mail went out.
  readonly pendingEmail = signal<string | null>(null);

  profileForm: FormGroup = this.fb.group({
    displayName: [this.auth.currentUser()?.displayName ?? '', Validators.maxLength(120)],
  });

  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      newPasswordConfirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  emailForm: FormGroup = this.fb.group({
    newEmail: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  deleteForm: FormGroup = this.fb.group({
    password: ['', Validators.required],
  });

  saveProfile(): void {
    if (!this.profileForm.valid) {
      return;
    }
    this.savingProfile.set(true);
    this.auth.updateProfile(this.profileForm.value.displayName).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.toast.success(this.transloco.translate('settings.profile.saved'));
      },
      // errors surface via the global httpErrorInterceptor toast
      error: () => this.savingProfile.set(false),
    });
  }

  changePassword(): void {
    if (!this.passwordForm.valid) {
      return;
    }
    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.authApi.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset();
        this.toast.success(this.transloco.translate('settings.password.changed'));
      },
      error: () => this.changingPassword.set(false),
    });
  }

  changeEmail(): void {
    if (!this.emailForm.valid) {
      return;
    }
    this.changingEmail.set(true);
    const { newEmail, password } = this.emailForm.value;
    this.authApi.changeEmail({ newEmail, password }).subscribe({
      next: () => {
        this.changingEmail.set(false);
        this.pendingEmail.set(newEmail);
        this.emailForm.reset();
      },
      error: () => this.changingEmail.set(false),
    });
  }

  deleteAccount(): void {
    if (!this.deleteForm.valid) {
      return;
    }
    if (!confirm(this.transloco.translate('settings.danger.confirm'))) {
      return;
    }
    this.deleting.set(true);
    this.auth.deleteAccount(this.deleteForm.value.password).subscribe({
      next: () => this.toast.success(this.transloco.translate('settings.danger.deleted')),
      error: () => this.deleting.set(false),
    });
  }
}
```

- [ ] **Step 5: Template**

`apps/frontend/src/app/components/settings/settings.component.html`:

```html
<div class="settings-page">
  <h1>{{ 'settings.title' | transloco }}</h1>

  <mat-card>
    <mat-card-header>
      <mat-card-title>{{ 'settings.profile.title' | transloco }}</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <form class="settings-form profile-form" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.profile.displayName' | transloco }}</mat-label>
          <input matInput type="text" formControlName="displayName" />
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="!profileForm.valid || savingProfile()">{{ 'settings.profile.save' | transloco }}</button>
      </form>
    </mat-card-content>
  </mat-card>

  <mat-card>
    <mat-card-header>
      <mat-card-title>{{ 'settings.password.title' | transloco }}</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <form class="settings-form password-form" [formGroup]="passwordForm" (ngSubmit)="changePassword()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.password.current' | transloco }}</mat-label>
          <input matInput type="password" formControlName="currentPassword" />
          @if (passwordForm.get('currentPassword')?.hasError('required')) {
          <mat-error>{{ 'settings.password.currentRequired' | transloco }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.password.new' | transloco }}</mat-label>
          <input matInput type="password" formControlName="newPassword" />
          @if (passwordForm.get('newPassword')?.hasError('minlength')) {
          <mat-error>{{ 'common.passwordMinLength' | transloco }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.password.confirm' | transloco }}</mat-label>
          <input matInput type="password" formControlName="newPasswordConfirm" />
          @if ( passwordForm.hasError('passwordMismatch') && passwordForm.get('newPasswordConfirm')?.touched ) {
          <mat-error>{{ 'common.passwordMismatch' | transloco }}</mat-error>
          }
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="!passwordForm.valid || changingPassword()">{{ 'settings.password.submit' | transloco }}</button>
      </form>
    </mat-card-content>
  </mat-card>

  <mat-card>
    <mat-card-header>
      <mat-card-title>{{ 'settings.email.title' | transloco }}</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      @if (pendingEmail()) {
      <p>
        {{ 'settings.email.sent' | transloco }}
        <strong>{{ pendingEmail() }}</strong>{{ 'settings.email.sentSuffix' | transloco }}
      </p>
      } @else {
      <form class="settings-form email-form" [formGroup]="emailForm" (ngSubmit)="changeEmail()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.email.new' | transloco }}</mat-label>
          <input matInput type="email" formControlName="newEmail" />
          @if (emailForm.get('newEmail')?.hasError('email')) {
          <mat-error>{{ 'common.emailInvalid' | transloco }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.email.password' | transloco }}</mat-label>
          <input matInput type="password" formControlName="password" />
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="!emailForm.valid || changingEmail()">{{ 'settings.email.submit' | transloco }}</button>
      </form>
      }
    </mat-card-content>
  </mat-card>

  <mat-card>
    <mat-card-header>
      <mat-card-title class="danger-title">{{ 'settings.danger.title' | transloco }}</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <p>{{ 'settings.danger.body' | transloco }}</p>
      <form class="settings-form delete-form" [formGroup]="deleteForm" (ngSubmit)="deleteAccount()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'settings.danger.password' | transloco }}</mat-label>
          <input matInput type="password" formControlName="password" />
        </mat-form-field>
        <button mat-raised-button color="warn" type="submit" [disabled]="!deleteForm.valid || deleting()">{{ 'settings.danger.submit' | transloco }}</button>
      </form>
    </mat-card-content>
  </mat-card>
</div>
```

- [ ] **Step 6: Spec**

`apps/frontend/src/app/components/settings/settings.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { AuthService } from '../../core/auth/auth.service';
import { AuthApiService } from '../../core/auth/auth.api.service';
import { ToastService } from '../../core/services/toast.service';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  const updateProfile = jest.fn();
  const deleteAccount = jest.fn();
  const changePassword = jest.fn();
  const changeEmail = jest.fn();
  const toastSuccess = jest.fn();

  const setup = async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent, getTranslocoTestingModule()],
      providers: [
        provideNoopAnimations(),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'u1',
              email: 'me@example.org',
              role: 'user',
              displayName: 'Me',
            }),
            updateProfile,
            deleteAccount,
          },
        },
        {
          provide: AuthApiService,
          useValue: { changePassword, changeEmail },
        },
        { provide: ToastService, useValue: { success: toastSuccess } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => jest.clearAllMocks());

  it('prefills the profile form with the current display name', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance.profileForm.value.displayName).toBe('Me');
  });

  it('submits a password change and resets the form', async () => {
    changePassword.mockReturnValue(of({}));
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      newPasswordConfirm: 'new-password-123',
    });
    component.changePassword();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(component.passwordForm.value.currentPassword).toBeNull();
  });

  it('keeps the password form invalid on mismatch', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.passwordForm.setValue({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      newPasswordConfirm: 'different',
    });

    expect(component.passwordForm.hasError('passwordMismatch')).toBe(true);
  });

  it('shows the pending state after requesting an email change', async () => {
    changeEmail.mockReturnValue(of(undefined));
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.emailForm.setValue({
      newEmail: 'new@example.org',
      password: 'secret-password',
    });
    component.changeEmail();

    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.org',
      password: 'secret-password',
    });
    expect(component.pendingEmail()).toBe('new@example.org');
  });

  it('asks for confirmation before deleting the account', async () => {
    deleteAccount.mockReturnValue(of(undefined));
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = await setup();
    const component = fixture.componentInstance;

    component.deleteForm.setValue({ password: 'secret-password' });
    component.deleteAccount();

    expect(deleteAccount).not.toHaveBeenCalled();

    (window.confirm as jest.Mock).mockReturnValue(true);
    component.deleteAccount();
    expect(deleteAccount).toHaveBeenCalledWith('secret-password');
  });
});
```

- [ ] **Step 7: Verify + commit**

```bash
npx nx test frontend && npx nx build frontend
git add -A && git commit -m "feat(frontend): account settings page (profile, password, email, delete)"
```

---

### Task 13: Disabled accounts + admin user management — API

**Files:**

- Modify: `libs/shared/src/lib/enums/error-code.enum.ts`
- Modify: `libs/shared/src/lib/models/auth.model.ts`
- Create: `apps/api/src/app/auth/dto/update-user-role.dto.ts`
- Create: `apps/api/src/app/auth/dto/update-user-status.dto.ts`
- Modify: `apps/api/src/app/auth/users.service.ts`
- Modify: `apps/api/src/app/auth/auth.service.ts`
- Modify: `apps/api/src/app/auth/auth.controller.ts`
- Modify: `apps/api/src/app/auth/auth.service.spec.ts`

**Interfaces:**

- Consumes: `users.disabled_at` (Task 1), pagination pieces (Task 5), `RolesGuard`/`@Roles` (existing), `RefreshTokensService.revokeAllForUser`.
- Produces (Task 14 consumes):
  - `ErrorCode.ACCOUNT_DISABLED`
  - `AdminUser extends AuthUser { emailVerifiedAt: string | null; disabledAt: string | null; createdAt: string }`
  - shared `UpdateUserRoleDto { role: UserRole }`, `UpdateUserStatusDto { disabled: boolean }`
  - `GET /api/auth/users?page=&pageSize=&sort=&order=` → `PageResponse<AdminUser>` (admin; default sort `createdAt desc` — **newest first, so freshly created e2e users land on page 1**)
  - `PATCH /api/auth/users/:id/role`, `PATCH /api/auth/users/:id/status` → `AdminUser` (admin; self-change forbidden; disabling revokes all sessions)
  - login gate: disabled user → 403 `errorCode: ACCOUNT_DISABLED`; refresh of a disabled user → 401
  - `UsersService.listAll()` is REMOVED (replaced by `listPaged`)

- [ ] **Step 1: Shared types**

`libs/shared/src/lib/enums/error-code.enum.ts` — add after `EMAIL_NOT_VERIFIED`:

```typescript
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
```

`libs/shared/src/lib/models/auth.model.ts` — add:

```typescript
// Admin view of a user — what GET /auth/users returns.
export interface AdminUser extends AuthUser {
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface UpdateUserStatusDto {
  disabled: boolean;
}
```

(`auth.model.ts` needs no new imports — `UserRole` is already imported.)

- [ ] **Step 2: Write the failing tests**

Add to `auth.service.spec.ts` (new mocks: `const updateRole = jest.fn();`, `const setDisabled = jest.fn();` — add both to the UsersService useValue):

```typescript
describe('login of a disabled account', () => {
  it('rejects with 403 ACCOUNT_DISABLED', async () => {
    findByEmail.mockResolvedValue({
      ...storedUser,
      disabled_at: new Date().toISOString(),
    });

    await expect(service.login('admin@example.org', 'secret-password')).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: 'ACCOUNT_DISABLED' }),
    });
    expect(issue).not.toHaveBeenCalled();
  });
});

describe('refresh of a disabled account', () => {
  it('rejects like an invalid token', async () => {
    findValid.mockResolvedValue({ id: 'rt-1', user_id: 'user-1' });
    findById.mockResolvedValue({
      ...storedUser,
      disabled_at: new Date().toISOString(),
    });

    await expect(service.refresh('some-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('setUserRole', () => {
  it('forbids changing your own role', async () => {
    await expect(service.setUserRole('user-1', 'user-1', UserRole.USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateRole).not.toHaveBeenCalled();
  });

  it('updates the role of another user', async () => {
    const adminUser = {
      id: 'user-2',
      email: 'other@example.org',
      role: UserRole.MODERATOR,
      displayName: null,
      emailVerifiedAt: null,
      disabledAt: null,
      createdAt: new Date().toISOString(),
    };
    updateRole.mockResolvedValue(adminUser);

    await expect(service.setUserRole('user-1', 'user-2', UserRole.MODERATOR)).resolves.toEqual(adminUser);
    expect(updateRole).toHaveBeenCalledWith('user-2', UserRole.MODERATOR);
  });
});

describe('setUserStatus', () => {
  it('forbids disabling your own account', async () => {
    await expect(service.setUserStatus('user-1', 'user-1', true)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('disabling revokes all sessions of the target', async () => {
    setDisabled.mockResolvedValue({ id: 'user-2', disabledAt: 'now' });

    await service.setUserStatus('user-1', 'user-2', true);

    expect(setDisabled).toHaveBeenCalledWith('user-2', true);
    expect(revokeAllForUser).toHaveBeenCalledWith('user-2');
  });

  it('enabling does not touch sessions', async () => {
    setDisabled.mockResolvedValue({ id: 'user-2', disabledAt: null });

    await service.setUserStatus('user-1', 'user-2', false);

    expect(revokeAllForUser).not.toHaveBeenCalled();
  });
});
```

Add `ForbiddenException` and `NotFoundException` to the `@nestjs/common` import in the spec. Run: `npx nx test api` — expected: FAIL.

- [ ] **Step 3: UsersService — listPaged / updateRole / setDisabled**

In `apps/api/src/app/auth/users.service.ts`:

Extend imports:

```typescript
import { Kysely, Selectable, sql } from 'kysely';
import { AdminUser, PageRequest, PageResponse, UserRole } from '@arvid-l-monorepo-template/shared';
import { pageOffset, resolveSort, toPageResponse } from '../../common/pagination/pagination.util';
```

(The old `AuthUser` import can go — nothing in this file uses it after this step.)

Add the whitelist above the class:

```typescript
const USER_SORT_COLUMNS: Record<string, string> = {
  email: 'email',
  role: 'role',
  createdAt: 'created_at',
};
```

DELETE `listAll()` and add:

```typescript
  private toAdminUser(user: Selectable<UserTable>): AdminUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      emailVerifiedAt: user.email_verified_at
        ? new Date(user.email_verified_at).toISOString()
        : null,
      disabledAt: user.disabled_at
        ? new Date(user.disabled_at).toISOString()
        : null,
      createdAt: new Date(user.created_at).toISOString(),
    };
  }

  async listPaged(query: PageRequest): Promise<PageResponse<AdminUser>> {
    const sortColumn = resolveSort(USER_SORT_COLUMNS, query.sort, 'created_at');
    // Newest first by default — fresh signups are what admins look for.
    const order = query.order ?? 'desc';

    const [rows, countRow] = await Promise.all([
      this.db
        .selectFrom('users')
        .selectAll()
        .where('deleted_at', 'is', null)
        .orderBy(sql.ref(sortColumn), order)
        .limit(query.pageSize)
        .offset(pageOffset(query))
        .execute(),
      this.db
        .selectFrom('users')
        .select(({ fn }) => fn.countAll<string>().as('total'))
        .where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow(),
    ]);

    return toPageResponse(
      rows.map((row) => this.toAdminUser(row)),
      Number(countRow.total),
      query,
    );
  }

  async updateRole(id: string, role: UserRole): Promise<AdminUser | undefined> {
    const user = await this.db
      .updateTable('users')
      .set({ role })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return user && this.toAdminUser(user);
  }

  async setDisabled(id: string, disabled: boolean): Promise<AdminUser | undefined> {
    const user = await this.db
      .updateTable('users')
      .set({ disabled_at: disabled ? new Date().toISOString() : null })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
    return user && this.toAdminUser(user);
  }
```

- [ ] **Step 4: AuthService — gates + admin actions**

In `auth.service.ts`:

`login()` — insert BEFORE the `email_verified_at` gate:

```typescript
if (user.disabled_at) {
  throw new ForbiddenException({
    statusCode: 403,
    errorCode: ErrorCode.ACCOUNT_DISABLED,
    message: 'This account has been disabled',
  });
}
```

`refresh()` — after the `user` lookup succeeds, before `revoke`:

```typescript
if (user.disabled_at) {
  // Same response as an invalid token — a disabled account keeps no
  // working sessions and learns nothing extra.
  throw new UnauthorizedException('Invalid or expired refresh token');
}
```

New methods (add `NotFoundException` to the `@nestjs/common` import and `AdminUser` to the shared import — `UserRole` is already imported):

```typescript
  async setUserRole(
    actorId: string,
    userId: string,
    role: UserRole,
  ): Promise<AdminUser> {
    if (actorId === userId) {
      // Self-demotion lock-out guard; promoting yourself is a no-op anyway.
      throw new ForbiddenException('You cannot change your own role');
    }
    const user = await this.usersService.updateRole(userId, role);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setUserStatus(
    actorId: string,
    userId: string,
    disabled: boolean,
  ): Promise<AdminUser> {
    if (actorId === userId) {
      throw new ForbiddenException('You cannot disable your own account');
    }
    const user = await this.usersService.setDisabled(userId, disabled);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (disabled) {
      // The login gate blocks new sessions; this kills the existing ones.
      await this.refreshTokensService.revokeAllForUser(userId);
    }
    return user;
  }
```

- [ ] **Step 5: DTO classes + controller**

`apps/api/src/app/auth/dto/update-user-role.dto.ts`:

```typescript
import { UpdateUserRoleDto as SharedUpdateUserRoleDto, UserRole } from '@arvid-l-monorepo-template/shared';
import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto implements SharedUpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
```

`apps/api/src/app/auth/dto/update-user-status.dto.ts`:

```typescript
import { UpdateUserStatusDto as SharedUpdateUserStatusDto } from '@arvid-l-monorepo-template/shared';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto implements SharedUpdateUserStatusDto {
  @IsBoolean()
  disabled!: boolean;
}
```

In `auth.controller.ts` — add `Param`, `Query` to the `@nestjs/common` import; `AdminUser`, `PageResponse` to the shared import; import `PageQueryDto`, both new DTOs. Replace the `users()` endpoint with:

```typescript
  // Role-protected examples — the pattern to copy for admin endpoints.
  // Roles are hierarchical: @Roles(UserRole.MODERATOR) would admit admins too.
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  users(@Query() query: PageQueryDto): Promise<PageResponse<AdminUser>> {
    return this.usersService.listPaged(query);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<AdminUser> {
    return this.authService.setUserRole(actor.sub, id, dto.role);
  }

  @Patch('users/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<AdminUser> {
    return this.authService.setUserStatus(actor.sub, id, dto.disabled);
  }
```

- [ ] **Step 6: Run tests + smoke**

```bash
npx nx test api && npx nx build api
```

Manual smoke (optional but cheap — requires `docker compose up -d` and `npx nx serve api` in a second terminal):

```bash
npm run user:create -- smoke-admin@dev.local secret123 admin
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke-admin@dev.local","password":"secret123"}' | \
  node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s "http://localhost:3000/api/auth/users?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `{"items":[…],"total":…,"page":1,"pageSize":5}`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): disabled-account gate + paginated admin user endpoints (role/status)"
```

---

### Task 14: Admin users page — frontend

**Files:**

- Modify: `apps/frontend/src/app/core/auth/token-storage.service.ts`
- Create: `apps/frontend/src/app/core/auth/admin.guard.ts`
- Create: `apps/frontend/src/app/core/auth/admin.guard.spec.ts`
- Modify: `apps/frontend/src/app/core/auth/auth.service.ts`
- Create: `apps/frontend/src/app/core/api/admin.api.service.ts`
- Create: `apps/frontend/src/app/components/admin/admin-users.component.ts`
- Create: `apps/frontend/src/app/components/admin/admin-users.component.html`
- Create: `apps/frontend/src/app/components/admin/admin-users.component.spec.ts`
- Create: `apps/frontend/src/app/components/admin/index.ts`
- Modify: `apps/frontend/src/app/core/constants/routes.constants.ts`
- Modify: `apps/frontend/src/app/app.routes.ts`
- Modify: `apps/frontend/src/app/app.component.html`

**Interfaces:**

- Consumes: Task 13 endpoints + `AdminUser`; pagination FE convention (Task 6); `admin.users.*` keys.
- Produces: `ROUTES.ADMIN_USERS = 'admin/users'`; `TokenStorageService.role` (JWT payload decode, UI-gating only); `adminGuard`; `AuthService.isAdmin` computed; `AdminApiService`. The disable/enable control is a **text button** (`Disable`/`Enable`) and the status column shows `Active`/`Disabled` — Task 15's e2e asserts those words.

- [ ] **Step 1: Role from the stored JWT**

Add to `TokenStorageService`:

```typescript
  // Reads the role claim from the stored access token (base64url payload).
  // UI-gating only — the API enforces roles server-side on every request.
  get role(): string | null {
    const token = this.token;
    if (!token) {
      return null;
    }
    try {
      const payload = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      return typeof payload.role === 'string' ? payload.role : null;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 2: adminGuard + spec (TDD)**

`apps/frontend/src/app/core/auth/admin.guard.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { adminGuard } from './admin.guard';
import { TokenStorageService } from './token-storage.service';

describe('adminGuard', () => {
  const run = (storage: Partial<TokenStorageService>) =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TokenStorageService, useValue: storage }],
    }).runInInjectionContext(() => adminGuard({} as never, { url: '/admin/users' } as never));

  it('redirects anonymous visitors to login', () => {
    const result = run({ isLoggedIn: false, role: null }) as UrlTree;
    expect(result.toString()).toContain('/login');
  });

  it('redirects non-admins to the start page', () => {
    const result = run({ isLoggedIn: true, role: 'user' }) as UrlTree;
    expect(result.toString()).toBe('/');
  });

  it('admits admins', () => {
    expect(run({ isLoggedIn: true, role: 'admin' })).toBe(true);
  });
});
```

Run: `npx nx test frontend` — expected: FAIL (file missing).

`apps/frontend/src/app/core/auth/admin.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { ROUTES } from '../constants/routes.constants';
import { TokenStorageService } from './token-storage.service';

// Reads the role straight from the stored JWT (synchronous — no race with
// the async /auth/me session restore). UI-gating only; the API enforces.
export const adminGuard: CanActivateFn = (_route, state) => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.isLoggedIn) {
    return router.createUrlTree([ROUTES.LOGIN], {
      queryParams: { returnUrl: state.url },
    });
  }
  return tokenStorage.role === UserRole.ADMIN ? true : router.createUrlTree(['/']);
};
```

Run: `npx nx test frontend` — expected: PASS.

- [ ] **Step 3: isAdmin signal + API service**

`core/auth/auth.service.ts` — add next to `isLoggedIn` (import `UserRole` from shared):

```typescript
  readonly isAdmin = computed(
    () => this.currentUser()?.role === UserRole.ADMIN,
  );
```

`apps/frontend/src/app/core/api/admin.api.service.ts`:

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AdminUser, PageRequest, PageResponse, UserRole } from '@arvid-l-monorepo-template/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  readonly http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/auth/users`;

  getUsers(request: Partial<PageRequest> = {}): Observable<PageResponse<AdminUser>> {
    let params = new HttpParams().set('page', request.page ?? 1).set('pageSize', request.pageSize ?? 20);
    if (request.sort) {
      params = params.set('sort', request.sort);
    }
    if (request.order) {
      params = params.set('order', request.order);
    }
    return this.http.get<PageResponse<AdminUser>>(this.apiUrl, { params });
  }

  updateRole(id: string, role: UserRole): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${id}/role`, { role });
  }

  updateStatus(id: string, disabled: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.apiUrl}/${id}/status`, {
      disabled,
    });
  }
}
```

- [ ] **Step 4: Admin users component**

`apps/frontend/src/app/components/admin/admin-users.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AdminUser, UserRole } from '@arvid-l-monorepo-template/shared';
import { AdminApiService } from '../../core/api/admin.api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatSelectModule, MatTableModule, MatPaginatorModule, TranslocoPipe],
  templateUrl: './admin-users.component.html',
  styles: `
    .admin-users-page {
      max-width: 64rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .users-table {
      width: 100%;
    }
    .role-select {
      width: 8.5rem;
    }
  `,
})
export class AdminUsersComponent {
  private readonly adminApi = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  readonly auth = inject(AuthService);

  readonly users = signal<AdminUser[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(20);

  readonly displayedColumns = ['displayName', 'email', 'role', 'verified', 'status', 'createdAt', 'actions'];
  readonly roles = Object.values(UserRole);

  constructor() {
    this.loadUsers();
  }

  loadUsers(): void {
    this.adminApi.getUsers({ page: this.pageIndex() + 1, pageSize: this.pageSize() }).subscribe({
      next: (page) => {
        this.users.set(page.items);
        this.total.set(page.total);
      },
      // errors surface via the global httpErrorInterceptor toast
      error: () => undefined,
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadUsers();
  }

  isSelf(user: AdminUser): boolean {
    return user.id === this.auth.currentUser()?.id;
  }

  onRoleChange(user: AdminUser, role: UserRole): void {
    this.adminApi.updateRole(user.id, role).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('admin.users.roleChanged'));
        this.loadUsers();
      },
      // reload puts the real server state back after a failed change
      error: () => this.loadUsers(),
    });
  }

  onToggleStatus(user: AdminUser): void {
    this.adminApi.updateStatus(user.id, !user.disabledAt).subscribe({
      next: () => {
        this.toast.success(this.transloco.translate('admin.users.statusChanged'));
        this.loadUsers();
      },
      error: () => this.loadUsers(),
    });
  }
}
```

`apps/frontend/src/app/components/admin/admin-users.component.html`:

```html
<div class="admin-users-page">
  <h1>{{ 'admin.users.title' | transloco }}</h1>

  <table mat-table [dataSource]="users()" class="users-table">
    <ng-container matColumnDef="displayName">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.displayName' | transloco }}</th>
      <td mat-cell *matCellDef="let user">{{ user.displayName || '—' }} @if (isSelf(user)) { ({{ 'admin.users.self' | transloco }}) }</td>
    </ng-container>

    <ng-container matColumnDef="email">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.email' | transloco }}</th>
      <td mat-cell *matCellDef="let user">{{ user.email }}</td>
    </ng-container>

    <ng-container matColumnDef="role">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.role' | transloco }}</th>
      <td mat-cell *matCellDef="let user">
        <mat-select class="role-select" [value]="user.role" [disabled]="isSelf(user)" (selectionChange)="onRoleChange(user, $event.value)">
          @for (role of roles; track role) {
          <mat-option [value]="role">{{ role }}</mat-option>
          }
        </mat-select>
      </td>
    </ng-container>

    <ng-container matColumnDef="verified">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.verified' | transloco }}</th>
      <td mat-cell *matCellDef="let user">{{ user.emailVerifiedAt ? '✓' : '—' }}</td>
    </ng-container>

    <ng-container matColumnDef="status">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.status' | transloco }}</th>
      <td mat-cell *matCellDef="let user">{{ (user.disabledAt ? 'admin.users.disabled' : 'admin.users.active') | transloco }}</td>
    </ng-container>

    <ng-container matColumnDef="createdAt">
      <th mat-header-cell *matHeaderCellDef>{{ 'admin.users.createdAt' | transloco }}</th>
      <td mat-cell *matCellDef="let user">{{ user.createdAt | date: 'short' }}</td>
    </ng-container>

    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef></th>
      <td mat-cell *matCellDef="let user">
        @if (!isSelf(user)) {
        <button mat-stroked-button type="button" (click)="onToggleStatus(user)">{{ (user.disabledAt ? 'admin.users.enable' : 'admin.users.disable') | transloco }}</button>
        }
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
  </table>

  <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)" />
</div>
```

`apps/frontend/src/app/components/admin/index.ts`:

```typescript
export * from './admin-users.component';
```

- [ ] **Step 5: Component spec**

`apps/frontend/src/app/components/admin/admin-users.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { UserRole } from '@arvid-l-monorepo-template/shared';
import { AdminUsersComponent } from './admin-users.component';
import { AdminApiService } from '../../core/api/admin.api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { getTranslocoTestingModule } from '../../core/i18n/transloco-testing';

describe('AdminUsersComponent', () => {
  const me = {
    id: 'admin-1',
    email: 'admin@example.org',
    role: UserRole.ADMIN,
    displayName: 'Admin',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    disabledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const other = {
    ...me,
    id: 'user-2',
    email: 'user@example.org',
    role: UserRole.USER,
    displayName: null,
  };

  const getUsers = jest.fn();
  const updateStatus = jest.fn();
  const updateRole = jest.fn();

  const setup = async () => {
    getUsers.mockReturnValue(of({ items: [me, other], total: 2, page: 1, pageSize: 20 }));
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent, getTranslocoTestingModule()],
      providers: [
        provideNoopAnimations(),
        {
          provide: AdminApiService,
          useValue: { getUsers, updateStatus, updateRole },
        },
        {
          provide: AuthService,
          useValue: { currentUser: signal(me) },
        },
        { provide: ToastService, useValue: { success: jest.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminUsersComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => jest.clearAllMocks());

  it('loads and renders the first page of users', async () => {
    const fixture = await setup();
    const el: HTMLElement = fixture.nativeElement;

    expect(getUsers).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(el.textContent).toContain('user@example.org');
    expect(el.textContent).toContain('Active');
  });

  it('hides the disable button on your own row', async () => {
    const fixture = await setup();
    const rows = fixture.nativeElement.querySelectorAll('tr[mat-row]');

    expect(rows[0].textContent).not.toContain('Disable'); // self
    expect(rows[1].textContent).toContain('Disable');
  });

  it('toggles the status of another user and reloads', async () => {
    updateStatus.mockReturnValue(of({ ...other, disabledAt: 'now' }));
    const fixture = await setup();

    fixture.componentInstance.onToggleStatus(other);

    expect(updateStatus).toHaveBeenCalledWith('user-2', true);
    expect(getUsers).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 6: Route + toolbar link**

`routes.constants.ts`: add `ADMIN_USERS: 'admin/users',`

`app.routes.ts` (import `AdminUsersComponent` from `./components/admin` and `adminGuard` from `./core/auth/admin.guard`):

```typescript
  {
    path: ROUTES.ADMIN_USERS,
    component: AdminUsersComponent,
    canActivate: [adminGuard],
  },
```

`app.component.html` — inside the `@if (auth.isLoggedIn())` block, before the settings link:

```html
@if (auth.isAdmin()) {
<a mat-button [routerLink]="['/', ROUTES.ADMIN_USERS]">{{ 'nav.users' | transloco }}</a>
}
```

- [ ] **Step 7: Verify + commit**

```bash
npx nx test frontend && npm run quality
git add -A && git commit -m "feat(frontend): admin users page (paginated list, role select, disable/enable)"
```

---

### Task 15: E2E coverage, docs, final quality gate

**Files:**

- Modify: `apps/frontend-e2e/src/e2e/auth.cy.ts`
- Create: `apps/frontend-e2e/src/e2e/admin.cy.ts`
- Modify: `docs/OVERVIEW.md`
- Modify: `docs/NEW-PROJECT.md`
- Modify: `docs/TEMPLATE-COMPLETION-GUIDE.md`

**Interfaces:**

- Consumes: `create-user.ts` script (creates verified users; role param optional), form classes `password-form` (Task 12), `Disable`/`Enable`/`Active`/`Disabled`/`Users` copy (Task 14), default users sort `createdAt desc` (Task 13 — new e2e users appear on page 1).

- [ ] **Step 1: Settings e2e test**

Add to `apps/frontend-e2e/src/e2e/auth.cy.ts`, reusing the file's existing helper for user creation (`cy.exec` + `create-user.ts`) and its login pattern:

```typescript
it('lets a user change their password in settings', () => {
  const email = `settings-${Date.now()}@e2e.local`;
  createVerifiedUser(email, 'password-1');

  cy.visit('/login');
  cy.get('input[formControlName=email]').type(email);
  cy.get('input[formControlName=password]').type('password-1');
  cy.contains('button', 'Login').click();
  cy.contains('.user-email', email).should('be.visible');

  cy.contains('a', 'Settings').click();
  cy.get('.password-form input[formControlName=currentPassword]').type('password-1');
  cy.get('.password-form input[formControlName=newPassword]').type('password-2');
  cy.get('.password-form input[formControlName=newPasswordConfirm]').type('password-2');
  cy.get('.password-form button[type=submit]').click();
  cy.contains('Password changed').should('be.visible');

  cy.contains('button', 'Logout').click();

  cy.get('input[formControlName=email]').type(email);
  cy.get('input[formControlName=password]').type('password-2');
  cy.contains('button', 'Login').click();
  cy.contains('.user-email', email).should('be.visible');
});
```

(If the existing helper has a different name/signature than `createVerifiedUser(email, password)`, use that one — it exists in this file already.)

- [ ] **Step 2: Admin e2e spec**

Create `apps/frontend-e2e/src/e2e/admin.cy.ts`:

```typescript
describe('Admin user management', () => {
  const ts = Date.now();
  const adminEmail = `admin-${ts}@e2e.local`;
  const userEmail = `member-${ts}@e2e.local`;
  const password = 'password-123';

  const createUser = (email: string, role?: string) => cy.exec(`cd "$(git rev-parse --show-toplevel)" && npx tsx tools/scripts/create-user.ts ${email} ${password}${role ? ` ${role}` : ''}`);

  it('admin can open the users page and disable an account', () => {
    createUser(adminEmail, 'admin');
    createUser(userEmail);

    cy.visit('/login');
    cy.get('input[formControlName=email]').type(adminEmail);
    cy.get('input[formControlName=password]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', adminEmail).should('be.visible');

    // Toolbar link only renders for admins.
    cy.contains('a', 'Users').click();
    // Default sort createdAt desc — both fresh users are on page 1.
    cy.contains('tr', userEmail).should('be.visible');

    cy.contains('tr', userEmail).contains('button', 'Disable').click();
    cy.contains('tr', userEmail).contains('Disabled').should('be.visible');

    // The disabled user cannot log in anymore.
    cy.contains('button', 'Logout').click();
    cy.get('input[formControlName=email]').type(userEmail);
    cy.get('input[formControlName=password]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('button', 'Logout').should('not.exist');
  });

  it('non-admins get redirected away from the users page', () => {
    const plainEmail = `plain-${ts}@e2e.local`;
    createUser(plainEmail);

    cy.visit('/login');
    cy.get('input[formControlName=email]').type(plainEmail);
    cy.get('input[formControlName=password]').type(password);
    cy.contains('button', 'Login').click();
    cy.contains('.user-email', plainEmail).should('be.visible');

    cy.visit('/admin/users');
    // adminGuard redirects to '/', which itself redirects to /examples.
    cy.location('pathname').should('eq', '/examples');
  });
});
```

- [ ] **Step 3: Full e2e run**

```bash
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
```

Expected: ALL specs pass (app, auth incl. new settings test, admin). Debug pattern if not: read the screenshot in `apps/frontend-e2e/cypress/screenshots/`, grep the API log for the failing request's status.

- [ ] **Step 4: Update the docs**

`docs/OVERVIEW.md`:

- API baseline: add bullets for **account self-service** (change password revokes other sessions / change email via link to new address / delete account = hard delete + cascade), **admin endpoints** (paginated `GET /auth/users`, role/status PATCH, self-change guards, `ACCOUNT_DISABLED` gate), **pagination convention** (`PageQueryDto` + `resolveSort` whitelist, example slice = reference).
- Frontend baseline: add **settings page**, **admin users page** (adminGuard reads the JWT role), **i18n** (Transloco en/de, toolbar toggle, `public/i18n/*.json`, testing helper), **legal pages + 404 + footer**, register privacy checkbox + display name.
- "What's still missing": remove nothing; the table stays as is.

`docs/NEW-PROJECT.md`:

- Add a step "Replace the legal placeholders" (edit `legal.imprint.body` / `legal.privacy.body` in BOTH `apps/frontend/public/i18n/en.json` and `de.json` — Impressum is legally required in Germany).
- Add a note under the walkthrough: default UI language is `en`; set `defaultLang: 'de'` in `app.config.ts` for German-first projects; all UI strings live in `public/i18n/`.

`docs/TEMPLATE-COMPLETION-GUIDE.md`: append a done-log entry for this round (date, feature list, key decisions: hard-delete rationale, 400-vs-401 rule, JWT-role guard, users default sort desc).

- [ ] **Step 5: Final quality gate + commit**

```bash
npm run quality
lsof -ti :3000 -ti :4200 | xargs kill; npx nx e2e frontend-e2e
git add -A && git commit -m "test(e2e)+docs: settings/admin coverage, docs for tier-2 round"
```

Expected: everything green. Then finish the branch via superpowers:finishing-a-development-branch (verify tests → present merge/PR options).

---

## Execution Notes (read before Task 1)

1. **Read `docs/OVERVIEW.md` and `CLAUDE.md` first** — they encode the repo conventions this plan builds on.
2. **Order is deliberate:** transloco (2) before any new UI so nothing is written twice; legal pages (4) before the register checkbox (8) that links to `/privacy`; pagination (5/6) before the admin list (13/14) that reuses it; Tasks 7+8 are an atomic pair for e2e purposes.
3. **When a template/spec you must edit differs from what this plan quotes** (e.g. lint-staged reformatted line breaks), apply the plan's _intent_ to the file as it exists — the target end state is what counts, byte-identical quoting is not guaranteed after prettier runs.
4. **Deviations:** if the API surface or shared types must differ from the Interfaces blocks, stop and document why in the commit body — later tasks reference these names verbatim.
5. **After the final task**, leave the branch for review or merge per the finishing skill — do NOT push unless asked.
