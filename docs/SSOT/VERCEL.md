# Vercel deployment (SSOT)

**Policy:** Branch/path skip logic lives in repo scripts only — do not duplicate rules in the Vercel dashboard.

## Projects

| Vercel project | Root directory | Build | Output | Git branch |
|----------------|----------------|-------|--------|------------|
| **kupa-pay** (marketing + Next.js proxy) | `cost-share-app/apps/web` | `vercel.json` → `bash scripts/build-web-next.sh` | Next.js default (`.next`) | Production: `main` only |
| **kupapay-dev** (marketing preview) | `cost-share-app/apps/web` | same | `.next` | Preview: `dev` only |
| **Expo web app** (product UI at proxied paths) | `cost-share-app/apps/mobile` | `vercel.json` → `npm run build:web` via `build-app-web.sh` | `dist` | Prod: `main`; dev app preview: `dev` |

Project IDs for dev routing (branch guard in `vercel-should-build.sh`):

- `prj_ldRyqXhp9Gg0QAHCNzEBw3VIcWbc`
- `prj_wa5noNsRFK5797IRthACeREIa8jR`

## Dashboard settings (cannot be expressed in `vercel.json`)

For **each** connected project:

1. **Root Directory** — table above (must match or builds run from repo root and fail).
2. **Ignored Build Step** — must delegate to repo SSOT (exit `0` = skip, `1` = build):
   - Web/marketing root `cost-share-app/apps/web`:
     ```bash
     bash scripts/vercel-should-build.sh web
     ```
   - Expo web root `cost-share-app/apps/mobile`:
     ```bash
     bash ../web/scripts/vercel-should-build.sh mobile
     ```
3. **Install Command** — leave empty to use `vercel.json` `installCommand` (`cd ../.. && npm install --include=optional`).
4. **Node.js version** — 20.x (matches GitHub Actions).
5. **Environment variables** — Supabase publishable URL/key per [SUPABASE_ENVIRONMENTS.md](./SUPABASE_ENVIRONMENTS.md); Sentry see [PERFORMANCE.md](./PERFORMANCE.md) (`NEXT_PUBLIC_SENTRY_*`, optional `SENTRY_AUTH_TOKEN` for source maps on marketing builds).

## Free-tier frugality

- **Ignored build step** skips deploys when `apps/web` or `apps/mobile` + `packages/shared` are unchanged between commits.
- **Branch guard** skips prod project builds on non-`main` refs and dev projects on non-`dev` refs.
- **`[skip ci]`** in commit message skips Vercel build (same as Actions).
- Marketing Next.js uses `experimental.staleTimes` in `next.config.ts` for CDN-friendly caching.

## Related files

- [`cost-share-app/apps/web/vercel.json`](../../cost-share-app/apps/web/vercel.json)
- [`cost-share-app/apps/mobile/vercel.json`](../../cost-share-app/apps/mobile/vercel.json)
- [`cost-share-app/apps/web/scripts/vercel-should-build.sh`](../../cost-share-app/apps/web/scripts/vercel-should-build.sh)
- [`docs/CI_CD.md`](../CI_CD.md)
