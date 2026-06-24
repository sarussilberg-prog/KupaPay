# Apple Team ID + App Version — Single Source of Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Apple Team ID and the human-facing app version each flow from exactly one place in the repo, and add a CI guard that makes both impossible to silently re-duplicate.

**Architecture:** Two independent runtime values, one shared linchpin. The **Apple Team ID** flows from `apps/mobile/app.json` (`ios.appleTeamId`, the one build-time literal) for signing, and from the Supabase secret `KUPAPAY_IOS_TEAM_ID` through the `invite-landing` edge function + Vercel rewrite for the web AASA — the web repo holds zero team-id literals. The **app version** flows from `packages/shared/version.json`: a new `app.config.ts` injects it into the native build and `Constants.expoConfig.version`, while `APP_VERSION` (re-exported from `@cost-share/shared`) feeds every UI label. `app.config.ts` is the shared linchpin — it converts the mobile config to dynamic without disturbing the team-id literal. A single jest guard test asserts both invariants on every PR to `dev`.

**Tech Stack:** Expo SDK 54 (`app.config.ts`, `expo/config`), React Native, Next.js (web), npm workspaces (`@cost-share/shared`), Supabase edge functions + secrets, Postgres migrations, GitHub Actions, Jest (`jest-expo`).

---

## Context the implementer must know

**This is the authoritative state as of 2026-06-24. Read it before touching anything.**

### Why the Apple Team ID matters and how it broke
- iOS Universal Links require the AASA `appID` team prefix (`<TEAM_ID>.com.kupapay.mobile`) to **exactly** match the installed app's signing team. On mismatch, iOS silently opens Safari — no error.
- **Canonical value: `HVW3H3DLRB`** ("Nave Sarussi"). Verified three ways: EAS Build #5 (commit `b23d925`) signed with it was accepted by Apple; the APNs push key is registered under it; Apple Developer portal → Membership confirms it.
- The legacy/wrong value is `K3M6R85KA6` (a different, pre-registration Apple account).
- **Root cause of the live breakage:** a static file `apps/web/public/.well-known/apple-app-site-association` **shadows** the `vercel.json` rewrite (Vercel serves `public/` files before rewrites), so the Supabase function — which already serves the correct value from the prod secret — never runs for that path. Android `assetlinks.json` has no static shadow, which is why it works. The fix is to **delete the static file**, not edit it.
- The prod Supabase secret `KUPAPAY_IOS_TEAM_ID` is already `HVW3H3DLRB`. The **dev** secret is **unset** (dev AASA currently serves `.com.kupapay.mobile` with an empty prefix).

### Why the app version needs an SSOT
Today the version lives in **two** drifting places:
- `apps/mobile/version.json` = `{"version":"1.0.0"}` — read by `LoginScreen` display + the two bump workflows.
- `apps/mobile/app.json` `expo.version` = `"1.0.1"` — used by EAS build signing + `Constants.expoConfig.version` (SettingsScreen).

`1.0.1` is the authoritative store value (EAS Build #5). The SSOT becomes `packages/shared/version.json` = `{"version":"1.0.1"}`, consumed by both paths.

### Verified facts (do not re-investigate)
- `supabase/functions/invite-landing/well-known.ts` **already** derives `appID` from `env('KUPAPAY_IOS_TEAM_ID', …)` and has **no** hardcoded team id. **No change needed** — the guard only locks it in.
- `K3M6R85KA6` appears in **no** repo source today (only in the stale CDN cache + unset dev secret). The guard prevents reintroduction.
- The 4 published legal docs (privacy/terms × en/he) are **identical on dev and prod**. Each `content_md` has, right after the H1 title, exactly one locale-appropriate two-line block:
  - en: `**Effective date:** June 2, 2026\n**Version:** 1.0.0`
  - he: `**תאריך כניסה לתוקף:** 2 ביוני 2026\n**גרסה:** 1.0.0`
  These lines were edited directly in the live DB (not via a repo migration), so a new migration must strip them. The `legal_documents.version` column **stays** (internal bookkeeping, no longer displayed); `effective_date` stays and is rendered from the column.
- `tsconfig.base.json` already sets `resolveJsonModule: true` (JSON imports type-check everywhere).
- Jest `moduleNameMapper` maps `@cost-share/shared/*` → `packages/shared/src/*`. **Therefore `version.json` must never be imported via the package specifier** (`@cost-share/shared/version.json` would wrongly resolve to `src/version.json`). Always import it **relatively** (`../version.json` inside the package; `../../packages/shared/version.json` from `app.config.ts`). Consumers use the barrel `import { APP_VERSION } from '@cost-share/shared'`.
- CI (`/.github/workflows/ci.yml`, repo root) on every PR to `dev`: **Lint** (`npm run lint`) + **Mobile tests** (`npm test --workspace=@cost-share/mobile -- --passWithNoTests --ci`) → **auto squash-merge** on green. Migrations deploy to dev on push to `dev` and to prod on push to `main` via `deploy-staging.yml` / `deploy-production.yml`. Edge functions + Vercel deploy via their own git integrations.
- **`npm run lint` is a turbo no-op** in this repo: it runs `turbo run lint`, but no workspace defines a `lint` script and there is no eslint config anywhere, so it exits 0 **without type-checking**. CI's Lint job is therefore vacuous — the **Mobile tests** job is the real gate. This plan uses real checks instead: `npx tsc --noEmit` (mobile/web) and `npm run build --workspace=@cost-share/shared` (which runs `tsc`). Broken module resolution also surfaces at jest runtime (the guard + existing screen tests import the changed modules). CI does **not** type-check or build `apps/web` at all — the web type-check (Task A5) is a manual, local-only pre-merge step.

### Process constraints
- **Everything goes through `dev`** via PR. One PR for all repo changes in this plan is fine — the tasks are ordered so the tree stays green.
- Two steps are **out-of-band** (not in the PR): setting the dev Supabase secret, and (later) the natural `dev → main` promotion. They are called out explicitly in Phase F.

---

## File structure

**Create**
- `packages/shared/version.json` — the app-version SSOT literal `{"version":"1.0.1"}`.
- `packages/shared/src/version.ts` — exports `APP_VERSION` (reads the JSON relatively).
- `apps/mobile/app.config.ts` — dynamic Expo config; spreads `app.json` and injects `version` from the shared JSON.
- `apps/mobile/__tests__/guards/appConfig.test.ts` — executes `app.config.ts` and asserts it injects the SSOT version (the real gate, since `npm run lint` is a no-op).
- `supabase/migrations/20260624120000_legal_docs_strip_embedded_version.sql` — strips the embedded version/effective-date lines from the 4 published docs (dev + prod via pipeline).
- `apps/mobile/__tests__/guards/ssot.guard.test.ts` — the unified "never again" guard.
- `docs/SSOT/APPLE_TEAM_ID.md` — Apple Team ID runbook (repo-root `docs/SSOT/`, sibling to `SUPABASE_ENVIRONMENTS.md`).
- `docs/SSOT/APP_VERSION.md` — app-version runbook.

**Modify**
- `packages/shared/src/index.ts` — add `export * from './version'`.
- `apps/mobile/app.json` — remove the `version` field (only this; everything else, incl. `ios.appleTeamId`, stays).
- `apps/mobile/screens/auth/LoginScreen.tsx` — display from `APP_VERSION` instead of `version.json`.
- `apps/mobile/components/settings/LegalDocumentSheet.tsx` — show the app version (`APP_VERSION` + `legal.appVersion`) instead of the doc version.
- `apps/mobile/__tests__/components/settings/LegalDocumentSheet.test.tsx` — assert the app version label.
- `apps/mobile/i18n/locales/he.json` + `en.json` — replace `legal.versionLabel` with `legal.appVersion`.
- `apps/web/app/_components/LegalPage.tsx` — import + display `APP_VERSION`.
- `apps/web/lib/i18n.ts` — add `legal.appVersion` (he + en + type).
- `/.github/workflows/bump-version-dev.yml` + `bump-version-main.yml` — repoint to `packages/shared/version.json`.
- `apps/mobile/App.tsx` — delete the dead web AASA route (lines 269–283).

**Delete**
- `apps/mobile/version.json` — superseded by `packages/shared/version.json`.
- `apps/web/public/.well-known/apple-app-site-association` — the shadowing static file (root cause).

**Unchanged on purpose (do NOT touch)**
- `supabase/functions/invite-landing/well-known.ts` — already env-driven.
- `apps/mobile/screens/profile/SettingsScreen.tsx` — already reads `Constants.expoConfig?.version`; auto-receives `1.0.1`.
- `apps/mobile/services/legal.service.ts` + `LegalDocument` type — `version` column stays.
- `apps/mobile/eas.json` — `appVersionSource: remote` unchanged.

---

# Phase A — App Version SSOT

### Task A1: Create the version SSOT and export `APP_VERSION`

**Files:**
- Create: `packages/shared/version.json`
- Create: `packages/shared/src/version.ts`
- Modify: `packages/shared/src/index.ts:13`

- [ ] **Step 1: Create the SSOT JSON** (compact, single-line — the bump workflows edit it with `jq -c`)

`packages/shared/version.json`:
```json
{"version":"1.0.1"}
```

- [ ] **Step 2: Create the exporter**

`packages/shared/src/version.ts`:
```ts
import versionData from '../version.json';

/**
 * App version — the single source of truth for the human-facing version string.
 * The literal lives only in packages/shared/version.json. Consumed by the mobile
 * login + legal screens and the web legal page. The native build version and
 * Constants.expoConfig.version derive from the same file via apps/mobile/app.config.ts.
 */
export const APP_VERSION: string = versionData.version;
```

- [ ] **Step 3: Re-export from the barrel**

In `packages/shared/src/index.ts`, add after the `notifications` export (line 13):
```ts
export * from './version';
```

- [ ] **Step 4: Write the failing test**

`packages/shared/src/__tests__/version.test.ts` (create):
```ts
import { APP_VERSION } from '../index';
import versionJson from '../../version.json';

describe('APP_VERSION', () => {
  it('is a valid semver string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('equals the version.json SSOT', () => {
    expect(APP_VERSION).toBe(versionJson.version);
  });
});
```

> Note: the shared package has no jest runner of its own. This assertion is also enforced by the mobile guard test (Task E1), which imports `@cost-share/shared` under `jest-expo`. If `packages/shared` has no `test` script, skip running this file standalone and rely on Task E1 — but still create it as living documentation. (Check `packages/shared/package.json`; it currently has no `test` script.)

- [ ] **Step 5: Type-check the shared package with a real `tsc` build**

Run (from `cost-share-app`): `npm run build --workspace=@cost-share/shared`
Expected: PASS — `tsc` compiles `src/version.ts`, pulls in `../version.json`, and emits `dist/` cleanly. This proves the package-root `version.json` import resolves under the `composite` + `rootDir: ./src` config (verified: `resolveJsonModule` JSON inputs are exempt from rootDir-emit enforcement on modern TS — no `TS6059`/`TS6307`). Do **not** rely on `npm run lint` — it is a no-op here (see Context).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/version.json packages/shared/src/version.ts packages/shared/src/index.ts packages/shared/src/__tests__/version.test.ts
git commit -m "feat(shared): add APP_VERSION single source of truth"
```

---

### Task A2: Convert mobile config to `app.config.ts` and delete the per-app `version.json`

**Files:**
- Test: `apps/mobile/__tests__/guards/appConfig.test.ts`
- Create: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/app.json:6` (remove the `version` field — it is line **6**, directly below `"scheme"` on line 5)
- Delete: `apps/mobile/version.json`

> `npm run lint` does not type-check (see Context), so this task is gated by a real jest test that **executes** the dynamic config and asserts the injected version. TDD: test first.

- [ ] **Step 1: Write the failing test**

`apps/mobile/__tests__/guards/appConfig.test.ts`:
```ts
import appConfig from '../../app.config';
import versionJson from '../../../../packages/shared/version.json';

describe('app.config.ts', () => {
  it('injects the SSOT app version from packages/shared/version.json', () => {
    const result = (appConfig as (ctx: { config: Record<string, unknown> }) => { version?: string })({
      config: {},
    });
    expect(result.version).toBe(versionJson.version);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@cost-share/mobile -- appConfig --watchman=false`
Expected: FAIL with `Cannot find module '../../app.config'`.

- [ ] **Step 3: Create the dynamic config**

`apps/mobile/app.config.ts`:
```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';
import versionJson from '../../packages/shared/version.json';

// app.json remains the static base for everything (icons, plugins, ios.appleTeamId,
// android intent filters, …). This dynamic config only injects the app version from
// the single source of truth (packages/shared/version.json, also exported as
// APP_VERSION from @cost-share/shared) so the native build, Constants.expoConfig.version,
// and every in-app label can never drift. The `as ExpoConfig` cast acknowledges that
// the required name/slug come from app.json via the spread — no duplicated literals.
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    version: versionJson.version,
  }) as ExpoConfig;
```

- [ ] **Step 4: Remove the `version` literal from `app.json`**

In `apps/mobile/app.json`, delete line **6** entirely (the line below `"scheme"`):
```json
    "version": "1.0.1",
```
The `"scheme": "com.kupapay.mobile",` line (5) above and the `"orientation": "portrait",` line below stay. **Do NOT delete the `scheme` line** — deleting it breaks Universal-Link routing.

- [ ] **Step 5: Delete the superseded per-app version file**

```bash
git rm apps/mobile/version.json
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace=@cost-share/mobile -- appConfig --watchman=false`
Expected: PASS — `result.version` is `1.0.1` from `version.json`, proving `app.config.ts` reads the SSOT.

- [ ] **Step 7: Type-check the mobile package**

Run (from `apps/mobile`): `npx tsc --noEmit`
Expected: PASS. (Real type validation; `npm run lint` is a no-op — see Context.)

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/app.json apps/mobile/__tests__/guards/appConfig.test.ts
git commit -m "feat(mobile): drive expo version from shared version.json via app.config.ts"
```

---

### Task A3: Show `APP_VERSION` on the login screen

**Files:**
- Modify: `apps/mobile/screens/auth/LoginScreen.tsx:34` and `:212`

- [ ] **Step 1: Swap the import** — replace line 34:
```ts
import appVersion from '../../version.json';
```
with:
```ts
import { APP_VERSION } from '@cost-share/shared';
```

- [ ] **Step 2: Swap the display** — replace line 212:
```tsx
                        v{appVersion.version}
```
with:
```tsx
                        v{APP_VERSION}
```

- [ ] **Step 3: Type-check (the deleted file must have no remaining importers)**

Run (from `apps/mobile`): `npx tsc --noEmit`
Expected: PASS — nothing resolves `../../version.json` anymore. (The existing `LoginScreen` test plus the Task E1 guard also fail at jest runtime on a dangling import — a second safety net. `npm run lint` is a no-op and would not catch this.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/screens/auth/LoginScreen.tsx
git commit -m "refactor(mobile): login version label reads APP_VERSION"
```

---

### Task A4: Legal sheet shows the **app** version, not the document version

**Files:**
- Modify: `apps/mobile/__tests__/components/settings/LegalDocumentSheet.test.tsx` (test first)
- Modify: `apps/mobile/components/settings/LegalDocumentSheet.tsx:8` and `:72`
- Modify: `apps/mobile/i18n/locales/he.json:970`, `apps/mobile/i18n/locales/en.json:952`

- [ ] **Step 1: Update the failing test first**

In `apps/mobile/__tests__/components/settings/LegalDocumentSheet.test.tsx`:

(a) Add to the top imports (after line 2):
```ts
import { APP_VERSION } from '@cost-share/shared';
```

(b) Replace the i18n mock entry on line 32:
```ts
                'legal.versionLabel': 'v{{version}}',
```
with:
```ts
                'legal.appVersion': 'App version {{version}}',
```

(c) Replace the success-case assertion (rename + assert the app version, which is `1.0.1` while the doc version stays `1.0.0` — proving the switch). Change the test title on line 93 and the assertion on line 100:
```ts
    it('renders title, app version, effective date, and markdown body on success', () => {
```
```ts
        expect(getByText(`App version ${APP_VERSION}`)).toBeTruthy();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@cost-share/mobile -- LegalDocumentSheet --watchman=false`
Expected: FAIL — the component still renders `legal.versionLabel` with the doc version, so `App version 1.0.1` is not found.

- [ ] **Step 3: Add the value import to the component** — change line 8:
```ts
import type { LegalSlug } from '@cost-share/shared';
```
to:
```ts
import { APP_VERSION, type LegalSlug } from '@cost-share/shared';
```

- [ ] **Step 4: Switch the display** — replace line 72:
```tsx
                                    {t('legal.lastUpdated', { date: formattedDate })} · {t('legal.versionLabel', { version: query.data.version })}
```
with:
```tsx
                                    {t('legal.lastUpdated', { date: formattedDate })} · {t('legal.appVersion', { version: APP_VERSION })}
```

- [ ] **Step 5: Replace the i18n keys**

In `apps/mobile/i18n/locales/he.json` replace line 970:
```json
        "versionLabel": "גרסה {{version}}",
```
with:
```json
        "appVersion": "גרסת אפליקציה {{version}}",
```

In `apps/mobile/i18n/locales/en.json` replace line 952:
```json
        "versionLabel": "v{{version}}",
```
with:
```json
        "appVersion": "App version {{version}}",
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace=@cost-share/mobile -- LegalDocumentSheet --watchman=false`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/settings/LegalDocumentSheet.tsx apps/mobile/__tests__/components/settings/LegalDocumentSheet.test.tsx apps/mobile/i18n/locales/he.json apps/mobile/i18n/locales/en.json
git commit -m "feat(mobile): legal sheet shows app version from APP_VERSION"
```

---

### Task A5: Show `APP_VERSION` on the web legal page

**Files:**
- Modify: `apps/web/app/_components/LegalPage.tsx:8` and the effective-date block (lines 55–62)
- Modify: `apps/web/lib/i18n.ts` (he ~96, en ~190, type ~212)

- [ ] **Step 1: Add the value import** — change line 8:
```ts
import type { LegalSlug } from '@cost-share/shared';
```
to:
```ts
import { APP_VERSION, type LegalSlug } from '@cost-share/shared';
```

- [ ] **Step 2: Render the app version under the effective date** — replace the effective-date block (lines 55–62):
```tsx
            {data.effective_date && (
              <p className={`text-sm text-gray-400 mb-10 ${textAlign}`}>
                {t.legal.effectiveDate}
                {new Date(data.effective_date).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
              </p>
            )}
```
with:
```tsx
            {data.effective_date && (
              <p className={`text-sm text-gray-400 mb-1 ${textAlign}`}>
                {t.legal.effectiveDate}
                {new Date(data.effective_date).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
              </p>
            )}
            <p className={`text-sm text-gray-400 mb-10 ${textAlign}`}>
              {t.legal.appVersion}
              {APP_VERSION}
            </p>
```

- [ ] **Step 3: Add the web i18n strings**

In `apps/web/lib/i18n.ts`, Hebrew `legal` block (lines 93–97) — add `appVersion`:
```ts
    legal: {
      notFound: 'המסמך לא נמצא.',
      backHome: 'חזרה לעמוד הבית',
      effectiveDate: 'תוקף מ-',
      appVersion: 'גרסת אפליקציה ',
    },
```

English `legal` block (lines 187–191) — add `appVersion`:
```ts
    legal: {
      notFound: 'Document not found.',
      backHome: 'Back to home',
      effectiveDate: 'Effective from ',
      appVersion: 'App version ',
    },
```

The `Translations` type (line 212) — add `appVersion`:
```ts
  legal: { notFound: string; backHome: string; effectiveDate: string; appVersion: string };
```

- [ ] **Step 4: Type-check the web app — MANUAL, local-only (CI does NOT cover this)**

Run (from `apps/web`): `npx tsc --noEmit`
Expected: PASS — `APP_VERSION` resolves via `transpilePackages: ['@cost-share/shared']` (verified: exits 0 under `moduleResolution: bundler` + `resolveJsonModule`; webpack bundles JSON natively).
⚠️ CI runs **neither** `next build` nor any web `tsc` (only mobile jest + the no-op lint), and the PR auto-squash-merges on green. A web-only TypeScript/i18n-type mistake here would merge and only fail later at Vercel. You **must** run this check locally before opening/merging the PR.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/_components/LegalPage.tsx apps/web/lib/i18n.ts
git commit -m "feat(web): legal page shows app version from APP_VERSION"
```

---

# Phase B — Legal documents content migration

### Task B1: Strip the embedded version / effective-date lines

The app version is now rendered from the SSOT and the effective date from the `effective_date` column, so the two markdown lines are stale duplication. One migration handles **both** environments: it applies to dev on merge-to-`dev` (deploy-staging) and to prod on `dev → main` (deploy-production).

**Files:**
- Create: `supabase/migrations/20260624120000_legal_docs_strip_embedded_version.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260624120000_legal_docs_strip_embedded_version.sql`:
```sql
-- Strip the embedded "Effective date" / "Version" lines from published legal docs.
--
-- Why: the app version is now shown from a single source of truth
-- (packages/shared/version.json -> APP_VERSION) in the mobile legal sheet and the
-- web legal page, and the effective date is rendered from the
-- legal_documents.effective_date column. The two markdown lines inside content_md
-- duplicated that information and would drift on every release.
--
-- This rewrites content_md for the 4 currently-published rows (privacy/terms x
-- en/he), removing the two-line block that sits between the H1 title and the body.
-- The `version` column is intentionally kept (internal bookkeeping); it is simply
-- no longer displayed.
--
-- The content was edited directly in the live DB (not via a prior migration), so
-- this migration operates on the live rows on both dev and prod.
--
-- Forward-only and idempotent: regexp_replace is a no-op when the pattern is
-- already absent, so re-running this migration changes nothing.

-- English: "**Effective date:** ...\n**Version:** ...\n\n"
UPDATE public.legal_documents
SET content_md = regexp_replace(
        content_md,
        E'\\*\\*Effective date:\\*\\*[^\\n]*\\n\\*\\*Version:\\*\\*[^\\n]*\\n\\n',
        ''
    )
WHERE locale = 'en'
  AND slug IN ('privacy', 'terms');

-- Hebrew: "**תאריך כניסה לתוקף:** ...\n**גרסה:** ...\n\n"
UPDATE public.legal_documents
SET content_md = regexp_replace(
        content_md,
        E'\\*\\*תאריך כניסה לתוקף:\\*\\*[^\\n]*\\n\\*\\*גרסה:\\*\\*[^\\n]*\\n\\n',
        ''
    )
WHERE locale = 'he'
  AND slug IN ('privacy', 'terms');
```

- [ ] **Step 2: Dry-run the regex against live dev content (read-only, via the `supabase` MCP)**

Run this `SELECT` (does **not** mutate) to confirm each doc loses exactly the two lines and the title + body remain intact:
```sql
SELECT slug, locale,
  left(regexp_replace(
    regexp_replace(content_md,
      E'\\*\\*Effective date:\\*\\*[^\\n]*\\n\\*\\*Version:\\*\\*[^\\n]*\\n\\n',''),
      E'\\*\\*תאריך כניסה לתוקף:\\*\\*[^\\n]*\\n\\*\\*גרסה:\\*\\*[^\\n]*\\n\\n',''
  ), 120) AS new_head
FROM public.legal_documents WHERE is_published = true ORDER BY slug, locale;
```
Expected: each `new_head` shows the `# Title` (possibly preceded by one leading newline — the stored `content_md` opens with a `\n`), then one blank line, then the first body sentence — with **no** `**Effective date:**` / `**Version:**` / `**תאריך כניסה לתוקף:**` / `**גרסה:**` lines.

- [ ] **Step 3: Commit (the migration deploys via the pipeline, not by hand)**

```bash
git add supabase/migrations/20260624120000_legal_docs_strip_embedded_version.sql
git commit -m "feat(db): strip embedded version/effective-date from legal docs"
```

> Do **not** apply this migration manually via MCP. Let deploy-staging apply it to dev on merge and deploy-production apply it to prod on `dev → main`, so the migration ledger stays authoritative.

---

# Phase C — Version bump workflows

### Task C1: Repoint both bump workflows to the shared version.json

Both workflows reference `cost-share-app/apps/mobile/version.json`; they must edit the new SSOT instead.

**Files:**
- Modify: `/.github/workflows/bump-version-dev.yml` (lines 7, 32, 42, 67)
- Modify: `/.github/workflows/bump-version-main.yml` (lines 7, 32, 50, 75)

- [ ] **Step 1: Replace every path occurrence in the dev workflow**

In `/.github/workflows/bump-version-dev.yml`, replace all 4 occurrences of:
```
cost-share-app/apps/mobile/version.json
```
with:
```
cost-share-app/packages/shared/version.json
```
(This covers `paths-ignore` line 7, the two `VERSION_FILE=` assignments lines 32 & 42, and the PR-body "File" row line 67.)

- [ ] **Step 2: Replace every path occurrence in the main workflow**

In `/.github/workflows/bump-version-main.yml`, replace all occurrences of:
```
cost-share-app/apps/mobile/version.json
```
with:
```
cost-share-app/packages/shared/version.json
```
(Covers `paths-ignore` line 7, the two `VERSION_FILE=` assignments lines 32 & 50, and the PR-body "File" row line 75. The `git show HEAD~1:"$VERSION_FILE"` baseline read on **line 37** then reads the new path; its `|| jq -r '.version' "$VERSION_FILE"` fallback already handles the first `dev → main` promotion where `HEAD~1` lacks the new path. The comment on line 36 mentioning "version.json" is non-functional and may be left as-is.)

- [ ] **Step 3: Sanity-check no stale references remain**

Run (from repo root): `grep -rn "apps/mobile/version.json" .github/workflows/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/bump-version-dev.yml .github/workflows/bump-version-main.yml
git commit -m "ci: bump workflows target shared version.json"
```

---

# Phase D — Apple Team ID SSOT

### Task D1: Delete the shadowing static AASA file (fixes the live iOS symptom)

**Files:**
- Delete: `apps/web/public/.well-known/apple-app-site-association`

- [ ] **Step 1: Delete the file**

```bash
git rm apps/web/public/.well-known/apple-app-site-association
```

- [ ] **Step 2: Confirm the directory holds no other static `.well-known` files**

Run: `ls -la apps/web/public/.well-known/ 2>/dev/null || echo "directory gone (ok)"`
Expected: empty or gone. There must be **no** `assetlinks.json` either (Android already serves correctly via the rewrite — proof the rewrite works with no static file).

- [ ] **Step 3: Commit**

```bash
git add -A apps/web/public/.well-known
git commit -m "fix(web): delete static AASA so the Vercel rewrite serves the function"
```

> After this deploys, `vercel.json`'s rewrite reaches the `invite-landing` function, which serves `HVW3H3DLRB.com.kupapay.mobile` from the prod secret with `content-type: application/json`. Verified post-deploy in the Rollout section.
>
> **Why the rewrite wins (and why this is safe):** `apps/web` has *two* rewrites — a `vercel.json` rewrite mapping `/.well-known/*` → the function, and a lower-priority `next.config.ts` *fallback* rewrite proxying everything else to the separate Expo-web project. Vercel applies `public/` static files and `vercel.json` rewrites **before** Next fallback rewrites, so once the static shadow is gone, `/.well-known/apple-app-site-association` reaches the function — exactly as Android `assetlinks.json` already does (the control group). The production deploy also purges Vercel's edge cache that currently serves the stale static file (`x-vercel-cache: HIT`, `age: 73125`), so the function response is served immediately; only Apple's downstream AASA CDN (`max-age=3600`) and already-installed apps lag.

---

### Task D2: Delete the dead web AASA route in `App.tsx`

This handler is unreachable for `kupa-pay.com` (the rewrite always wins) and only adds a second hardcoded team id that can drift.

**Files:**
- Modify: `apps/mobile/App.tsx` (remove lines 269–283 + the trailing blank line)

- [ ] **Step 1: Delete the block** — remove these lines (269–283) in full:
```tsx
  if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined' && globalThis.location.pathname === '/.well-known/apple-app-site-association') {
    const aasa = {
      applinks: {
        apps: [],
        details: [{ appID: 'HVW3H3DLRB.com.kupapay.mobile', paths: ['/i/*', '/g/*'] }],
      },
    };
    // Write raw JSON directly — this path must return JSON, not a React screen.
    if (typeof globalThis.document !== 'undefined') {
      globalThis.document.open('application/json');
      globalThis.document.write(JSON.stringify(aasa));
      globalThis.document.close();
    }
    return null;
  }

```
The result must read directly from the `useEffect` cleanup (`}, [guardSession]);`) into `if (!isReady) {` with a single blank line between them.

- [ ] **Step 2: Confirm no AASA literal remains in `App.tsx`**

Run: `grep -n "apple-app-site-association\|com.kupapay.mobile" apps/mobile/App.tsx`
Expected: no output.

- [ ] **Step 3: Type-check (watch for now-unused imports)**

Run (from `apps/mobile`): `npx tsc --noEmit`
Expected: PASS. If `Platform` becomes unused after the deletion, remove it from its import; if it is still used elsewhere in `App.tsx`, leave it (verify with `grep -n "Platform\." apps/mobile/App.tsx` before removing). `npm run lint` is a no-op and will not flag an unused import — rely on `tsc`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "refactor(mobile): remove dead web AASA route and its hardcoded team id"
```

> After this, the Expo-web app origin intentionally serves **no** AASA. That is correct by design: iOS validates Universal Links only against the `associatedDomains` host (`applinks:kupa-pay.com` → the marketing site → the function), never against the app's proxied origin, so the app-origin AASA was always dead.

---

# Phase E — The unified "never again" CI guard

### Task E1: One jest test that locks **both** invariants

Placed in the mobile package so it runs under the existing **Mobile tests** CI job on every PR to `dev`. By now every prior task is done, so the guard should pass on the first run; its value is preventing regression.

**Files:**
- Create: `apps/mobile/__tests__/guards/ssot.guard.test.ts`

- [ ] **Step 1: Write the guard**

`apps/mobile/__tests__/guards/ssot.guard.test.ts`:
```ts
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { APP_VERSION } from '@cost-share/shared';

// Paths resolved from this file: cost-share-app/apps/mobile/__tests__/guards/
const MOBILE_DIR = resolve(__dirname, '../..'); // cost-share-app/apps/mobile
const APPS_DIR = resolve(__dirname, '../../..'); // cost-share-app/apps
const MONOREPO_DIR = resolve(__dirname, '../../../..'); // cost-share-app
const REPO_ROOT = resolve(__dirname, '../../../../..'); // git root (holds .github)

const read = (p: string): string => readFileSync(p, 'utf8');

const CANONICAL_TEAM_ID = 'HVW3H3DLRB';
const LEGACY_TEAM_ID = 'K3M6R85KA6';
const TEAM_ID_RE = /[A-Z0-9]{10}\.com\.kupapay\.mobile/;

// Only scan text/source files — never decode binaries (PNGs etc.) as UTF-8.
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|txt|html|css)$/;

function grepDir(dir: string, needle: string): string[] {
  const skip = new Set([
    'node_modules', '.next', 'dist', '.expo', 'build',
    '.turbo', 'coverage', 'out', 'web-build', '.vercel',
  ]);
  const hits: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      if (skip.has(entry)) continue;
      const full = resolve(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT_EXT.test(full) && read(full).includes(needle)) hits.push(full);
    }
  };
  walk(dir);
  return hits;
}

describe('Apple Team ID — single source of truth', () => {
  it('app.json declares the canonical Apple Team ID', () => {
    const appJson = JSON.parse(read(resolve(MOBILE_DIR, 'app.json')));
    expect(appJson.expo.ios.appleTeamId).toBe(CANONICAL_TEAM_ID);
  });

  it('the legacy team id appears in no scanned source', () => {
    for (const f of [
      resolve(MOBILE_DIR, 'app.json'),
      resolve(MOBILE_DIR, 'app.config.ts'),
      resolve(MOBILE_DIR, 'App.tsx'),
      resolve(MONOREPO_DIR, 'supabase/functions/invite-landing/well-known.ts'),
    ]) {
      expect(read(f)).not.toContain(LEGACY_TEAM_ID);
    }
    expect(grepDir(resolve(APPS_DIR, 'web'), LEGACY_TEAM_ID)).toEqual([]);
  });

  it('no static .well-known file shadows the Vercel rewrite', () => {
    const wellKnown = resolve(APPS_DIR, 'web/public/.well-known');
    for (const name of ['apple-app-site-association', 'assetlinks.json']) {
      expect(existsSync(resolve(wellKnown, name))).toBe(false);
    }
  });

  it('the edge function derives appID from env, with no hardcoded team id', () => {
    const fn = read(resolve(MONOREPO_DIR, 'supabase/functions/invite-landing/well-known.ts'));
    expect(fn).toContain('${TEAM_ID}.com.kupapay.mobile');
    expect(fn).not.toMatch(TEAM_ID_RE);
  });

  it('App.tsx has no hardcoded AASA appID literal or handler', () => {
    const app = read(resolve(MOBILE_DIR, 'App.tsx'));
    expect(app).not.toMatch(TEAM_ID_RE);
    expect(app).not.toContain('apple-app-site-association');
  });
});

describe('App version — single source of truth', () => {
  const versionJsonPath = resolve(MONOREPO_DIR, 'packages/shared/version.json');
  const fileVersion = (): string => JSON.parse(read(versionJsonPath)).version;

  it('packages/shared/version.json holds a valid semver', () => {
    expect(fileVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('APP_VERSION equals the version.json SSOT', () => {
    expect(APP_VERSION).toBe(fileVersion());
  });

  it('app.json has no version literal (it lives only in version.json)', () => {
    const appJson = JSON.parse(read(resolve(MOBILE_DIR, 'app.json')));
    expect(appJson.expo.version).toBeUndefined();
  });

  it('app.config.ts exists (the dynamic config that injects the version)', () => {
    expect(existsSync(resolve(MOBILE_DIR, 'app.config.ts'))).toBe(true);
  });

  it('app.config.ts injects the version from the shared version.json', () => {
    const cfg = read(resolve(MOBILE_DIR, 'app.config.ts'));
    expect(cfg).toContain('packages/shared/version.json');
    expect(cfg).toMatch(/version:\s*versionJson\.version/);
  });

  it('the per-app version.json is gone', () => {
    expect(existsSync(resolve(MOBILE_DIR, 'version.json'))).toBe(false);
  });

  it('the login screen reads APP_VERSION, not a json file', () => {
    const login = read(resolve(MOBILE_DIR, 'screens/auth/LoginScreen.tsx'));
    expect(login).toContain('APP_VERSION');
    expect(login).not.toContain('version.json');
  });

  it('the legal sheet shows the app version, not the document version', () => {
    const sheet = read(resolve(MOBILE_DIR, 'components/settings/LegalDocumentSheet.tsx'));
    expect(sheet).toContain('legal.appVersion');
    expect(sheet).toContain('APP_VERSION');
    expect(sheet).not.toContain('legal.versionLabel');
  });

  it('the removed versionLabel key is gone and appVersion exists in both locales', () => {
    for (const loc of ['he', 'en']) {
      const json = JSON.parse(read(resolve(MOBILE_DIR, `i18n/locales/${loc}.json`)));
      expect(json.legal.versionLabel).toBeUndefined();
      expect(typeof json.legal.appVersion).toBe('string');
    }
  });

  it('both bump workflows target the shared version.json', () => {
    for (const wf of ['bump-version-dev.yml', 'bump-version-main.yml']) {
      const text = read(resolve(REPO_ROOT, '.github/workflows', wf));
      expect(text).toContain('cost-share-app/packages/shared/version.json');
      expect(text).not.toContain('cost-share-app/apps/mobile/version.json');
    }
  });
});
```

- [ ] **Step 2: Run the guard — expect all green**

Run: `npm test --workspace=@cost-share/mobile -- ssot.guard --watchman=false`
Expected: PASS (all assertions).

- [ ] **Step 3: Prove the guard actually catches regressions**

Temporarily reintroduce a regression and confirm RED, then revert:
```bash
# (a) re-add a static shadow
echo '{}' > apps/web/public/.well-known/apple-app-site-association
npm test --workspace=@cost-share/mobile -- ssot.guard --watchman=false   # expect FAIL on the shadow test
git checkout -- apps/web/public 2>/dev/null; rm -f apps/web/public/.well-known/apple-app-site-association
# (b) confirm green again
npm test --workspace=@cost-share/mobile -- ssot.guard --watchman=false   # expect PASS
```

- [ ] **Step 4: Run the full mobile suite (no collateral breakage)**

Run: `npm test --workspace=@cost-share/mobile -- --watchman=false`
Expected: PASS (LegalDocumentSheet + SettingsScreen + legal.service suites included).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/__tests__/guards/ssot.guard.test.ts
git commit -m "test(mobile): guard both Apple Team ID and app version SSOTs"
```

---

# Phase F — Runbooks and out-of-band steps

### Task F1: Add the SSOT runbooks

**Files:**
- Create: `docs/SSOT/APPLE_TEAM_ID.md` (repo root, beside `SUPABASE_ENVIRONMENTS.md`)
- Create: `docs/SSOT/APP_VERSION.md`

- [ ] **Step 1: Apple Team ID runbook**

`docs/SSOT/APPLE_TEAM_ID.md`:
```markdown
# Apple Team ID — Single Source of Truth

**Canonical value: `HVW3H3DLRB`** ("Nave Sarussi").

## Why it matters
iOS Universal Links validate the AASA `appID` team prefix
(`HVW3H3DLRB.com.kupapay.mobile`) against the installed app's signing team. On
mismatch, iOS silently opens Safari instead of the app — no error.

## How the value is verified
1. EAS Build #5 (commit `b23d925`) signed with `HVW3H3DLRB` was accepted by Apple.
2. The APNs push key is registered under `HVW3H3DLRB`; push authenticates.
3. Apple Developer portal → Membership → Team ID.

The legacy value `K3M6R85KA6` is a different, pre-registration Apple account and
must never reappear in the repo.

## Where it lives (two legitimate runtimes, never a third)
| Consumer | Source of truth |
| --- | --- |
| EAS build signing | `apps/mobile/app.json` → `ios.appleTeamId` (the one build-time literal) |
| Web AASA serving | Supabase secret `KUPAPAY_IOS_TEAM_ID` per environment |

Web flow: `vercel.json` rewrites `/.well-known/apple-app-site-association` to the
`invite-landing` edge function, which builds `appID` from the secret. The web repo
contains **zero** team-id literals. There must be **no** static file under
`apps/web/public/.well-known/` — a static file shadows the rewrite (Vercel serves
`public/` before rewrites) and was the original cause of the broken iOS links.
`apps/web` also has a lower-priority `next.config.ts` *fallback* rewrite to the
Expo-web project; `vercel.json` rewrites take precedence, so `/.well-known/*`
reaches the function — as Android `assetlinks.json` already proves (same rewrite,
no static shadow). A production deploy purges the Vercel edge cache, so the function
response is served immediately; only Apple's AASA CDN (`max-age=3600`) lags.

## Per-environment secret
- **prod** (`jfqxjjjbpxbwwvoygahu`): `KUPAPAY_IOS_TEAM_ID=HVW3H3DLRB` (set).
- **dev** (`drxfbicunusmipdgbgdk`): `KUPAPAY_IOS_TEAM_ID=HVW3H3DLRB` (see Task F2).

## How to rotate (if the Apple team ever changes)
1. Update `apps/mobile/app.json` → `ios.appleTeamId`; rebuild via EAS.
2. Update the Supabase secret `KUPAPAY_IOS_TEAM_ID` on **each** environment.
3. Update the canonical value above and in `apps/mobile/__tests__/guards/ssot.guard.test.ts`.
4. Wait out Apple's AASA CDN cache (`max-age=3600`); reinstall to refresh.

## Guardrail
`apps/mobile/__tests__/guards/ssot.guard.test.ts` fails CI if the canonical value
changes, the legacy value reappears, a static `.well-known` file returns, or the
function/App.tsx grows a hardcoded team id.

## Verify in production
`curl https://kupa-pay.com/.well-known/apple-app-site-association` →
`HVW3H3DLRB.com.kupapay.mobile`, `content-type: application/json` (the function,
not a static file).
```

- [ ] **Step 2: App version runbook**

`docs/SSOT/APP_VERSION.md`:
```markdown
# App Version — Single Source of Truth

**The version literal lives only in `packages/shared/version.json`.**

## Consumers (all derive from that one file)
- `packages/shared/src/version.ts` exports `APP_VERSION` (re-exported from
  `@cost-share/shared`) → mobile `LoginScreen`, mobile `LegalDocumentSheet`,
  web `LegalPage`.
- `apps/mobile/app.config.ts` injects it into the Expo config `version` →
  the native build **and** `Constants.expoConfig.version` (mobile `SettingsScreen`).

`apps/mobile/app.json` has **no** `version` field; `app.config.ts` is the only place
that sets it (from the shared JSON).

## How it changes
- Push to `dev` → `bump-version-dev.yml` patch-bumps `packages/shared/version.json`.
- Merge to `main` → `bump-version-main.yml` minor-bumps and resets patch.
- Both workflows open and squash-merge their own bump PR.

## Store build numbers
`apps/mobile/eas.json` uses `appVersionSource: remote` with `autoIncrement`; EAS
manages store build numbers independently of this version string.

## Guardrail
`apps/mobile/__tests__/guards/ssot.guard.test.ts` fails CI if `app.json` regains a
version literal, `APP_VERSION` diverges from `version.json`, the old
`apps/mobile/version.json` reappears, a display stops using `APP_VERSION`, or a
bump workflow points at the old path.
```

- [ ] **Step 3: Commit**

```bash
git add docs/SSOT/APPLE_TEAM_ID.md docs/SSOT/APP_VERSION.md
git commit -m "docs(ssot): add Apple Team ID and App Version runbooks"
```

---

### Task F2: Set the dev Supabase secret (out-of-band — NOT in the PR)

Prod is already correct. Dev's `KUPAPAY_IOS_TEAM_ID` is unset, so dev AASA serves an empty prefix. There is no MCP tool for secrets — set it via the Supabase CLI or dashboard.

- [ ] **Step 1: Set the secret on the dev project**

```bash
npx supabase secrets set KUPAPAY_IOS_TEAM_ID=HVW3H3DLRB --project-ref drxfbicunusmipdgbgdk
```
(Or Supabase dashboard → dev project → Edge Functions → Secrets.)

- [ ] **Step 2: Verify dev serves the correct value**

```bash
curl -s https://drxfbicunusmipdgbgdk.supabase.co/functions/v1/invite-landing/.well-known/apple-app-site-association
```
Expected: `…"appID":"HVW3H3DLRB.com.kupapay.mobile"…`

> This is independent of the PR and can be done at any time.

---

## Rollout

1. **Open one PR to `dev`** with all committed changes (Phases A–F1). CI runs Lint + Mobile tests (incl. the new guard); on green it auto-squash-merges to `dev`.
2. **Set the dev Supabase secret** (Task F2) — independent of the PR.
3. **Dev verification** after merge:
   - Migration applied to dev (deploy-staging): re-run the read-only check from B1·Step 2 — the embedded lines are gone.
   - Web (dev domain / Vercel preview): legal pages show the app version `1.0.1` and the effective date; mobile login + legal sheet show `1.0.1`.
4. **Promote `dev → main`** (separate, deliberate merge) → deploy-production applies the migration to prod; Vercel rebuilds prod.
5. **Prod verification:**
   - `curl https://kupa-pay.com/.well-known/apple-app-site-association` → `HVW3H3DLRB.com.kupapay.mobile`, `content-type: application/json`.
   - Android `assetlinks.json` unchanged and correct.
   - A fresh iOS install picks up the corrected AASA (Apple CDN caches it; existing installs refresh on app update).

## Risks & rollback
- **Deleting the static AASA could break serving if the rewrite were misconfigured.** Mitigation: Android `assetlinks.json` already proves the rewrite works with no static file. Rollback: `git revert` the deletion.
- **CDN cache delays AASA visibility.** Expected; the function sets `max-age=3600`. No code impact.
- **The legal migration is data-only and forward-only.** If a doc's wording diverges from the captured pattern, `regexp_replace` no-ops that row (leaves it unchanged) rather than corrupting it; re-running is safe.

## Out of scope
- Rotating the actual Apple team (it is correct).
- Changing the prod Supabase secret (already correct).
- Android signing fingerprints (already served correctly via the function).
- Unifying store-listing version copy.

---

## Self-review

**Spec coverage — Apple Team ID design (`2026-06-24-apple-team-id-ssot-design.md`):**
- §1 delete static file → Task D1. ✓
- §2 delete App.tsx AASA route → Task D2. ✓
- §3 `app.json` keeps `appleTeamId` → unchanged + guarded (A2 removes only `version`). ✓
- §4 CI guard (all 5 assertions) → Task E1 "Apple Team ID" suite. ✓
- §5 dev secret → Task F2. ✓
- §6 runbook → Task F1 (`docs/SSOT/APPLE_TEAM_ID.md`). ✓

**Spec coverage — App Version design:**
- §1 `packages/shared/version.json` (1.0.1) → Task A1. ✓
- §2 `app.json` → `app.config.ts`, displays via Expo/`APP_VERSION` → A2/A3/A4 (+ SettingsScreen unchanged, auto). ✓
- §3 web `LegalPage` imports `APP_VERSION` → Task A5. ✓
- §4 legal-doc DB migration (dev + prod), `version` column kept → Task B1. ✓
- §5 legal screen shows app version, new `legal.appVersion`, remove `legal.versionLabel` → Task A4. ✓
- §6 bump workflows → shared `version.json` → Task C1. ✓
- §7 `eas.json` unchanged → respected. ✓
- §8 tests → Task A1/A4 unit tests + Task E1 guard. ✓

**Placeholder scan:** none — every step has exact paths, full code, and concrete commands.

**Type/name consistency:** `APP_VERSION` (export, all consumers, guard, tests) consistent; `legal.appVersion` (mobile + web i18n + component + test) consistent; `legal.versionLabel` removed everywhere it appeared (`LegalDocumentSheet.tsx`, both locale files, the test mock); migration filename `20260624120000_legal_docs_strip_embedded_version.sql` referenced consistently; bump path `cost-share-app/packages/shared/version.json` consistent across C1 + guard.

**Linchpin check:** `app.config.ts` (A2) is created before any consumer relies on the injected version, and it reads `version.json` (A1) which exists first. Ordering is dependency-safe.
