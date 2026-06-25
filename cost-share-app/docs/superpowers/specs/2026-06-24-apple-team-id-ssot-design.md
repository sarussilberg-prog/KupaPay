# Apple Team ID — Single Source of Truth

Date: 2026-06-24
Status: Approved (pending spec review)
Owner: Nave

## Problem

iOS Universal Links for `com.kupapay.mobile` are broken because the Apple App Site
Association (AASA) file served at `https://kupa-pay.com/.well-known/apple-app-site-association`
declares the wrong Apple Team prefix.

- The app binary (EAS build #5, commit `b23d925`) is signed under team **HVW3H3DLRB**.
- The live AASA declares `appID = K3M6R85KA6.com.kupapay.mobile`.

iOS requires the AASA `appID` team prefix to match the installed app's signing team
**exactly**. On mismatch, the OS silently opens Safari instead of the app — no error.

## Verified root cause

The live symptom is **not** a wrong value in a config file. It is an architectural
shadow plus a stale CDN cache:

1. The web app serves AASA dynamically: `vercel.json` rewrites
   `/.well-known/apple-app-site-association` to the Supabase `invite-landing` edge
   function, which builds the `appID` from the `KUPAPAY_IOS_TEAM_ID` secret.
2. A **static file** `apps/web/public/.well-known/apple-app-site-association` also
   exists. Vercel serves static `public/` files **before** applying `vercel.json`
   rewrites, so the static file *shadows* the rewrite and the function never runs
   for this path.
3. PR #42 (merged 2026-06-24 12:07) corrected the *value* inside the static file to
   `HVW3H3DLRB`, but left the file in place — so the shadow and the dual source of
   truth remain, and the production CDN was still serving a ~20h-old cached copy
   with the old value.

### Evidence

| Probe | Result | Meaning |
| --- | --- | --- |
| `GET kupa-pay.com/.well-known/apple-app-site-association` | `K3M6R85KA6`, pretty-printed, `content-type: application/octet-stream`, `x-vercel-cache: HIT`, `age: 73125` | Static file served (not the function), stale cache |
| `GET <prod-supabase>/functions/v1/invite-landing/.well-known/apple-app-site-association` | `HVW3H3DLRB`, minified, `application/json` | The function and the prod secret are already correct |
| `GET kupa-pay.com/.well-known/assetlinks.json` (Android) | Matches the function exactly | No static file shadows this path → rewrite works (control group) |
| `GET <dev-supabase>/functions/v1/invite-landing/.well-known/apple-app-site-association` | `".com.kupapay.mobile"` (empty prefix) | The dev `KUPAPAY_IOS_TEAM_ID` secret is unset |

The Android `assetlinks.json` is the control group: same rewrite, no static shadow,
serves correctly. iOS breaks *only* because the leftover static file shadows it.

## Canonical value

**Apple Team ID = `HVW3H3DLRB`** ("Nave Sarussi"), verified three independent ways:

1. EAS build #5 was built from commit `b23d925` (which sets `HVW3H3DLRB`) and was
   accepted by Apple for `com.kupapay.mobile`.
2. The APNs push key is registered under `HVW3H3DLRB`; push authenticates.
3. Apple Developer portal → Membership → Team ID (manual confirmation).

The legacy/wrong value `K3M6R85KA6` is a different Apple account from before the
App ID was registered to the correct team.

## Target architecture (SSOT)

There are two *legitimately different* runtime consumers of the team ID. They cannot
share one literal because they execute in different runtimes:

| Consumer | Source of truth | Notes |
| --- | --- | --- |
| Web AASA serving | Supabase secret `KUPAPAY_IOS_TEAM_ID` (per environment) | Already correct on prod; unset on dev |
| EAS build signing | `apps/mobile/app.json` → `ios.appleTeamId` | Build-time; the one intentional literal in the repo |

The web repository must contain **zero** team-id literals. Everything web-facing
flows from the Supabase secret through the function and the Vercel rewrite, exactly
like Android `assetlinks.json` already does.

A CI guard test makes the two consumers impossible to silently diverge and makes the
shadowing static file impossible to reintroduce.

## Changes

### 1. Web — remove the shadow (fixes the live symptom)
- Delete the static file
  `apps/web/public/.well-known/apple-app-site-association`.
- After deploy, `vercel.json`'s rewrite reaches the function → serves `HVW3H3DLRB`
  from the prod secret with `application/json` and a sane cache header.

### 2. Mobile — remove the duplicate AASA route
- Delete the dead `Platform.OS === 'web'` AASA handler in `apps/mobile/App.tsx`
  (~lines 269–283). It is unreachable for `kupa-pay.com` (the rewrite always wins)
  and only adds a second hardcoded team id that can drift.

### 3. Mobile — keep `app.json` as the single build-time literal
- `apps/mobile/app.json` → `ios.appleTeamId` stays `HVW3H3DLRB` (already correct on
  dev/main). This is the only intentional team-id literal in the repo.

### 4. CI guard — "never again" (new mobile jest test)
New file `apps/mobile/__tests__/guards/appleTeamId.guard.test.ts`, run by the existing
`Mobile tests` CI job on every PR to `dev`. It asserts:
1. `app.json` `ios.appleTeamId` equals the verified canonical `HVW3H3DLRB`.
2. The legacy value `K3M6R85KA6` appears in **no** scanned source (app.json, App.tsx,
   `apps/web/**`, `supabase/functions/invite-landing/**`).
3. **No** static file exists under `apps/web/public/.well-known/` (anti-shadow rule):
   neither `apple-app-site-association` nor `assetlinks.json`.
4. `supabase/functions/invite-landing/well-known.ts` derives the `appID` from the
   env var and contains no hardcoded 10-char team id.
5. `App.tsx` contains no hardcoded AASA `appID` literal.

### 5. Dev environment — set the missing secret
- Set `KUPAPAY_IOS_TEAM_ID=HVW3H3DLRB` on the **dev** Supabase project so dev AASA
  stops serving an empty prefix. (Prod is already correct — no change.)

### 6. Runbook
- Add `docs/SSOT/APPLE_TEAM_ID.md`: the canonical value, how it is verified, the
  serving architecture, where the secret lives per environment, and how to rotate it.

## Rollout

1. PR to `dev` with changes 1–4 and 6. CI (lint + mobile tests, incl. the new guard)
   must pass; the repo auto-squash-merges to `dev` on green.
2. Vercel's git integration rebuilds the dev web project → verify dev domain (or the
   dev Supabase function once its secret is set) serves `HVW3H3DLRB`.
3. Set the dev Supabase secret (change 5) — independent of the PR.
4. `dev → main` merge → Vercel rebuilds prod → `kupa-pay.com` serves `HVW3H3DLRB`
   via the function. Edge-function and Vercel deploys are driven by their own git
   integrations, not the migration-only GitHub workflows.

## Verification

- `curl https://kupa-pay.com/.well-known/apple-app-site-association` returns
  `HVW3H3DLRB.com.kupapay.mobile` with `content-type: application/json` (proves the
  function — not a static file — is serving).
- Android `assetlinks.json` remains unchanged and correct.
- Fresh install / reinstall of the app picks up the corrected AASA (Apple's CDN
  caches AASA; existing installs refresh on app update).

## Risks & rollback

- **Risk:** deleting the static file could break serving if the rewrite were
  misconfigured. **Mitigation:** Android `assetlinks.json` already proves the rewrite
  works with no static file. **Rollback:** restore the file (git revert) to return to
  today's behavior.
- **Risk:** Apple CDN / Vercel CDN cache delays visibility. **Mitigation:** expected;
  the function sets `max-age=3600`. No code impact.

## Out of scope

- Rotating or changing the actual Apple Team (it is correct).
- Changing the prod Supabase secret (already correct).
- Android signing fingerprints (already served correctly via the function).
