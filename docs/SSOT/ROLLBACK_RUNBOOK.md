# Rollback runbook (dev / staging / production)

**Language:** English only.  
**Scope:** Recover from bad deploys without touching production unless explicitly approved.

---

## When to use which path

| Symptom | Environment | First action |
|---------|-------------|--------------|
| Bad web/marketing deploy | Vercel (dev or prod project) | Promote previous deployment in Vercel |
| Bad mobile OTA (JS only) | EAS Update | `eas update:rollback` on the affected branch |
| Bad Supabase migration (objects wrong/missing) | **dev** (`drxfbicunusmipdgbgdk`) | Forward-fix migration **or** history repair (below) |
| Bad Supabase migration | **production** | **Stop.** No automatic rollback. Follow [PROD_MIGRATION_REPAIR.md](../PROD_MIGRATION_REPAIR.md) with explicit human approval |

Never run seed, `supabase db reset`, or destructive SQL on **production** from automation.

---

## Vercel (web + Expo web export)

1. Open the Vercel project (**dev** staging project vs **kupa-pay** production project).
2. **Deployments** → find last green deployment before the incident.
3. **⋯ → Promote to Production** (prod) or redeploy preview for dev project.
4. Confirm `ignoreCommand` did not skip needed builds — if the fix is outside watched paths, trigger **Redeploy** with “Use existing build cache” off.

Branch routing is enforced in `cost-share-app/apps/web/scripts/vercel-should-build.sh` (dev project → `dev` ref only; prod → `main` only).

---

## Supabase — development (staging)

### A. Forward fix (preferred)

1. Revert or patch application code on `dev` if needed.
2. Add a **new** migration with a **fresh** `YYYYMMDDHHMMSS` prefix (see [SUPABASE_MIGRATION_VERSIONS.md](./SUPABASE_MIGRATION_VERSIONS.md)).
3. Merge to `dev`; [deploy-staging.yml](../../.github/workflows/deploy-staging.yml) applies via `supabase-ci-db-push.sh`.

### B. Migration history collision (`schema_migrations_pkey` / duplicate version)

**Symptom:** `db push` fails with duplicate key on `version`.

1. Compare local filename prefix vs remote:
   ```bash
   cd cost-share-app
   SUPABASE_ENV=development bash scripts/supabase-remote-migration-precheck.sh
   ```
2. If two PRs used the same prefix: renumber the **newer** file on a branch and merge again.
3. If remote history is wrong but SQL is idempotent: follow repair steps in [PROD_MIGRATION_REPAIR.md](../PROD_MIGRATION_REPAIR.md) **using development credentials only**.

### C. Destructive migration blocked in CI

Add a line-level marker after review:

```sql
DROP TABLE legacy_foo; -- destructive-ok: table unused since v2.4; dev-only cleanup
```

Or backward-compat marker documented in `supabase-safe-migration-check.sh` (`-- safe-breaking:`).

---

## Supabase — production

Manual [deploy-production.yml](../../.github/workflows/deploy-production.yml) only.

1. **validate-migrations** must pass (`supabase-safe-migration-check.sh`).
2. If deploy failed mid-push, use [PROD_MIGRATION_REPAIR.md](../PROD_MIGRATION_REPAIR.md) probes — read-only first.
3. Roll back **application** (Vercel promote, store rollback) before attempting schema repair.

---

## Mobile native builds

- **TestFlight / Play internal:** ship a fixed build from `dev`; do not roll back store production automatically.
- **EAS Update (JS):** rollback update group; native binary unchanged.

---

## Verification checklist (after rollback)

- [ ] CI **CI gate** green on `dev`
- [ ] Staging Supabase smoke: `bash cost-share-app/scripts/ci-staging-db-smoke.sh` (with dev secrets locally or re-run deploy-staging workflow)
- [ ] Web smoke: home + `/en` load on dev Vercel URL
- [ ] Mobile: cold start + groups list (Sentry `app.boot` / `supabase.http` if enabled)

---

## Related

- [SUPABASE_ENVIRONMENTS.md](./SUPABASE_ENVIRONMENTS.md)
- [CI_CD.md](../CI_CD.md)
- [PAYMENTS_INCIDENT_RUNBOOK.md](./PAYMENTS_INCIDENT_RUNBOOK.md)
