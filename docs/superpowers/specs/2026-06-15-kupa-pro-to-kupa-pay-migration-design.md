# Domain migration: kupa.pro → kupa-pay.com (full migration)

**Date:** 2026-06-15
**Branch:** `migrate/kupa-pro-to-kupa-pay` (off `origin/dev` @ `04e5a20`)
**Status:** Design — awaiting approval

## Goal

Make `kupa-pay.com` the single canonical domain for KupaPay (web + app deep links),
and fully retire `kupa.pro`. No trace of `kupa.pro` left in code, config, or infra.

## Locked decisions

- **Delete `kupa.pro` completely** — the owner is selling it. Remove it from the
  `kupa-prod` project *and* from the Vercel account.
- **Pre-launch, no real users** — breaking old `kupa.pro` links is acceptable.
  No backward-compatibility; `kupa.pro` is removed from the app too.
- **Land via `dev`** — all code changes go on this branch → merge to `dev`.
  They reach `main`/prod through the team's normal `dev → main` release. This
  migration is intentionally decoupled from the large pending `dev → main`
  feature release (166 files).
- **DNS via Vercel nameservers** — owner already switched `kupa-pay.com`
  nameservers to `ns1/ns2.vercel-dns.com`. Vercel now manages all DNS.
- **Edge function: hardcode `kupa-pay.com`** (YAGNI — not env-driven).
- **Keep Vercel project names** `kupa-prod` / `kupa-dev` (internal only; the build
  script selects the dev DB by project *ID*, not name).

## Already done (infra, before this branch)

- `kupa-pay.com` attached to `kupa-prod`; `dev.kupa-pay.com` attached to `kupa-dev`.
  Both verified serving the app over HTTPS with valid certs (confirmed via direct
  edge-IP curl).
- Nameservers moved to Vercel (propagating; up to 24h to reach all resolvers).

## Scope — code changes on this branch

### A. Web / shared (takes effect on next web deploy)
- `packages/shared/src/brand.ts` — `APP_WEB_HOST = 'kupa.pro'` → `'kupa-pay.com'`.
  This is the central constant; `APP_WEB_ORIGIN` and all invite / auth-callback /
  legal URLs derive from it.
- `apps/web/vercel.json` — `www` redirect: `www.kupa.pro → kupa.pro` becomes
  `www.kupa-pay.com → kupa-pay.com`.
- `apps/mobile/vercel.json` — legacy config (live projects use `apps/web` as root);
  update host refs for consistency.
- `apps/web/scripts/build-app-web.sh`, `apps/web/supabase-public.production.defaults`
  — comment text mentioning `kupa.pro`.

### B. Mobile app (requires `expo prebuild` + a new build; active only in a published release)
- `apps/mobile/app.json` — iOS `associatedDomains` `applinks:kupa.pro` → `kupa-pay.com`;
  Android intent-filter `host` (2 entries).
- `apps/mobile/eas.json` — `EXPO_PUBLIC_WEB_APP_URL` (2) → `https://kupa-pay.com`.
- `apps/mobile/.env.example`, `apps/mobile/.env.production.example` — `EXPO_PUBLIC_WEB_APP_URL`.
- `apps/mobile/services/auth.service.ts` — comment.

### C. Supabase edge function `invite-landing` (deploy to BOTH projects after change)
- `supabase/functions/invite-landing/legal.ts`, `render.ts` — canonical URLs,
  `og:image`, legal footer links, app-store fallback `kupa.pro` → `kupa-pay.com`.
  `index.ts` comments.
- Deploy to prod (`jfqxjjjbpxbwwvoygahu`) and dev (`drxfbicunusmipdgbgdk`).
  Note: `apps/web/vercel.json` rewrites point well-known/`/i/`/`/g/` at the **prod**
  edge function for both domains, so deploying prod is what makes the landing pages
  reflect the new domain; dev deploy is for parity.

### D. Tests (keep suite green — currently 781/781)
- Update `kupa.pro` assertions → `kupa-pay.com` in:
  `__tests__/components/InviteLinkBlock.test.tsx`,
  `__tests__/lib/platformShare.test.ts`,
  `__tests__/services/{invite,auth,deepLinks}.service.test.ts`.

### E. Vercel infra (via CLI, by the agent)
- Add `www.kupa-pay.com` → `kupa-prod` + redirect to apex.
- Set `kupa-pay.com` as the primary production domain on `kupa-prod`.
- Remove `kupa.pro` from `kupa-prod`, then remove `kupa.pro` from the account.
- Env `EXPO_PUBLIC_WEB_APP_URL`: `kupa-prod` (Production) → `https://kupa-pay.com`;
  `kupa-dev` (Preview) → `https://dev.kupa-pay.com`.

### F. Supabase Auth (by the agent — browser or Management API token)
- Both projects: Site URL + redirect allowlist — add `https://kupa-pay.com` and
  `https://dev.kupa-pay.com`, remove `kupa.pro`.

## Out of scope

- `EXPO_PUBLIC_SENTRY_DSN` is empty (no web/app error tracking) — flagged separately.
- The large pending `dev → main` feature release.
- Renaming Vercel projects.

## Constraints & risks

- **Mobile native links** (associatedDomains / intent filters) only activate after
  `expo prebuild` + a newly published store build. Pre-launch, so acceptable.
- **prod currently serves an old deployment** (title still "CoPay"). When this lands
  on `main` and Vercel redeploys, prod generates `kupa-pay.com` links.
- **Push discipline:** this branch tracks `origin/dev`; push it as its own branch
  (`git push -u origin migrate/kupa-pro-to-kupa-pay`), never directly to `dev`.

## Verification

- **Baseline (done):** `npm install` exit 0; **781/781** tests pass; `@cost-share/shared`
  `tsc` exit 0; worktree clean.
- **Post-change:** re-run jest (expect 781 green); build `@cost-share/shared`;
  `git grep kupa.pro` returns nothing outside `docs/` history; Vercel serves
  `kupa-pay.com` + `www` redirect; `kupa.pro` absent from Vercel account.
