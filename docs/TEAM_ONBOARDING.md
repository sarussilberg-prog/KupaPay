# Team onboarding (KupaPay)

Welcome — this doc points you to env templates and safe setup. **Never commit secrets** (`.env`, service role keys, EAS tokens, Sentry auth tokens).

## 1. Clone and install

```bash
git clone https://github.com/sarussilberg-prog/KupaPay.git
cd KupaPay/cost-share-app
npm ci
```

## 2. Environment files

| Surface | Template | Local file |
|---------|----------|------------|
| Mobile app | [cost-share-app/apps/mobile/.env.example](../cost-share-app/apps/mobile/.env.example) | `cost-share-app/apps/mobile/.env` |
| Web app | [cost-share-app/apps/web/.env.example](../cost-share-app/apps/web/.env.example) | `cost-share-app/apps/web/.env.local` |
| Supabase scripts | [cost-share-app/supabase/.env.example](../cost-share-app/supabase/.env.example) | `cost-share-app/supabase/.env` |

Root [/.env.example](../.env.example) is an index only — it does not hold values.

**Supabase project:** use **development** (`drxfbicunusmipdgbgdk`) on `dev` branches. Production ref is documented in [docs/SSOT/SUPABASE_ENVIRONMENTS.md](./SSOT/SUPABASE_ENVIRONMENTS.md).

## 3. Run the mobile app

```bash
cd cost-share-app
npm run dev:mobile
```

See [cost-share-app/apps/mobile/AGENTS.md](../cost-share-app/apps/mobile/AGENTS.md) for OAuth, prebuild, and brand assets.

## 4. Quality gates before PR

```bash
cd cost-share-app
npm run lint
npm run typecheck
npm test --workspace=@cost-share/mobile -- --ci
```

SonarCloud runs on GitHub for PRs — see [docs/SSOT/CODE QUALITY.md](./SSOT/CODE%20QUALITY.md).

## 5. SSOT docs

- [docs/SSOT/README.md](./SSOT/README.md) — which doc to read for your task
- [docs/SSOT/SRS.md](./SSOT/SRS.md) — requirements
- [docs/SSOT/KNOWN_ISSUES.md](./SSOT/KNOWN_ISSUES.md) — open bugs and gaps
