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
