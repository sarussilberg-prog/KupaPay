# KupaPay Pro v2 — implementation plan (architecture + quality gates)

**Status:** Draft for owner approval — **no feature implementation until this plan is signed off.**  
**Last updated:** 2026-10-15  
**Scope:** Five Pro v2 features behind `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED`, RevenueCat entitlement `pro`, and group Trip Pass (`group_passes`).  
**Related:** [PRO_FEATURES_PROPOSAL.md](PRO_FEATURES_PROPOSAL.md), [KUPAPAY_PRO_SETUP.md](KUPAPAY_PRO_SETUP.md), [SSOT/SUPABASE_ENVIRONMENTS.md](SSOT/SUPABASE_ENVIRONMENTS.md)

---

## Executive summary

Pro v2 adds **trip tooling** (FX view, reminders, insights, budget, receipt OCR) without limiting free-tier splitting. Shipping money-adjacent features requires **quality gates first**: payment webhook hardening, migration safety, RLS/integration tests, staging discipline, E2E purchase smoke, monitoring, and release checklists. **Features are phased only after Phase 0 (gates) is complete.**

Closed exploratory PRs (#128–#132) are superseded by this plan.

---

## Part 1 — Architecture (five features + shared platform)

### 1.1 Design principles

| Principle | Implication |
|-----------|-------------|
| **Free ledger stays unlimited** | Pro gates convenience/analytics/automation, not expense creation or balances. |
| **Single entitlement source of truth** | Server: `has_pro(user, group)` + `get_my_pro_status`. Client: cache via React Query; never infer Pro from UI flags alone. |
| **Master flag** | `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=false` by default → perks unlocked for all (same pattern as export gating today). |
| **Clean boundaries** | Domain math in `@cost-share/shared`; Supabase RPCs for authoritative aggregates; edge functions for cron/webhooks/OCR; mobile infrastructure for I/O. |
| **Offline-first honesty** | Pro features that need network show unavailable states; no fake “Pro active” UX when entitlement or FX cannot be verified. |
| **Cost awareness** | OCR and frequent cron jobs are bounded; analytics prefer SQL/materialized paths over repeated full-table client pulls. |

### 1.2 Shared modules (target architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile (Expo)                             │
│  proEntitlements.service ──► get_my_pro_status RPC               │
│  proGating (isProPerkUnlocked) ◄── shared hasPro helpers         │
│  fxRates.service (24h cache) ◄── useExchangeRatesQuery           │
│  reminderScheduler (client prefs + server cron)                    │
│  analytics UI ◄── RPCs / cached snapshots                        │
│  budget UI ◄── group budget RPC + local progress                   │
│  receiptScan ◄── edge receipt-ocr + draft parser                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Supabase (authenticated + service_role)
┌───────────────────────────▼─────────────────────────────────────┐
│  RLS on groups, expenses, activity_events, pro tables            │
│  RPCs: has_pro, get_my_pro_status, set_* (Pro admin actions)     │
│  SQL views / RPCs: group_spending_* , pairwise debts (existing)  │
│  Cron edge: smart-reminder-dispatch, budget re-eval (optional)   │
│  Webhook: revenuecat-webhook (existing), send-push (existing)    │
└─────────────────────────────────────────────────────────────────┘
```

#### A. Entitlement / gating service

**Today:** `proEntitlements.service.ts`, `get_my_pro_status`, `has_pro`, `shouldSkipAdGate`, RevenueCat webhook → `profiles.pro_until`, `group_passes`.

**Target (Pro v2):**

| Layer | Responsibility |
|-------|----------------|
| **Shared** | `isProPerkUnlocked(hasPro, flag)`, `hasProFromTimestamps` — pure functions, unit-tested. |
| **Application** | `ProGatingPort`: `getProStatus(groupId?)`, `requirePro(groupId)` for use cases (export, scan, etc.). |
| **Infrastructure** | `proEntitlements.service` — RPC + RevenueCat refresh; React Query key `proStatus(groupId)`. |

**Rules:**

- Every Pro surface: `showUpsell = flag && !hasPro`; `featureEnabled = isProPerkUnlocked(hasPro, flag)`.
- Trip Pass: group-scoped `groupPassUntil` from RPC when `groupId` passed.
- Paywall: `featureKey` per surface for monetization analytics (existing pattern).

**No new entitlement types** for v2 unless owner adds B2B — reuse `pro` + Trip Pass.

#### B. FX rates service (caching)

**Today:** `exchangeRates.service.ts` — Open ER API + Frankfurter fallback, AsyncStorage 24h TTL; `useExchangeRatesQuery` with React Query staleTime 24h.

**Target:**

| Concern | Approach |
|---------|----------|
| **Trip currency view** | Convert pairwise debts client-side via `convertDebtsToTripCurrency(debts, target, rates)` (exists). |
| **Cache** | Keep 24h TTL; optional Supabase Edge cache later if rate limits bite — **not required for v2**. |
| **Offline** | Show last cached rates with “as of {date}” label; block conversion if no cache and offline. |
| **Security** | No API keys in client for public FX endpoints; no PII in rate requests. |

**Performance:** One query per `(base, symbols)` set per screen focus; dedupe via React Query keys (already).

#### C. Reminder / notification scheduler

**Today:** Manual remind — `send_settle_reminder` RPC → `activity_events` → `send-push`; push prefs in `notification_preferences`; `settle_up_reminder` kind.

**Target (smart reminders):**

| Component | Role |
|-----------|------|
| **Group settings** | `smart_reminder_interval_days` (≥3), enabled_by, last_run_at — Pro member configures. |
| **Anti-spam** | Per `(group_id, debtor_user_id)` last_sent_at; **hard floor 3 days** regardless of interval. |
| **Scheduler** | Daily edge `pro-smart-reminder-dispatch` (POST + `PUSH_WEBHOOK_SECRET`) → RPC `run_smart_payment_reminders`. |
| **Debt source** | Reuse pairwise debt math — service-role RPC mirroring `get_group_pairwise_debts` (no auth.uid() in cron). |
| **Delivery** | Reuse `settle_up_reminder` + `metadata.body` for digest text; WhatsApp = client share sheet (no server). |
| **In-app** | Activity feed + existing notification routing (`settleUpList` deep link). |

**RLS:** Only group members read reminder settings; only Pro users call `set_group_smart_reminder`; cron uses service_role.

#### D. Analytics aggregation (SQL views / RPCs)

**Today:** Client aggregates expenses for exports; no dedicated analytics RPCs.

**Target:**

| Deliverable | Implementation preference |
|-------------|---------------------------|
| **By category** | `get_group_spending_by_category(p_group_id, p_currency)` — SECURITY DEFINER, member check. |
| **By member (paid)** | `get_group_spending_by_member(p_group_id, p_currency)` — sum `expenses.amount` where `paid_by = member`. |
| **Over time** | Weekly buckets via `date_trunc('week', expense_date)` in SQL — avoids client timezone bugs. |
| **Optional materialized view** | `group_spending_daily_mv` refreshed on expense change — **only if** p95 latency > budget on large groups. |

**Client:** Thin hook `useGroupSpendingInsights(groupId, currency)` → RPC; chart UI renders bars only (no heavy chart library v1).

**Performance:** Index existing `expenses(group_id, is_deleted, expense_date, category)`; limit RPC to default currency first (multi-currency insights = v2.1).

#### E. Budget model

**Target schema (groups table or `group_trip_budgets` 1:1):**

| Column | Purpose |
|--------|---------|
| `trip_budget_amount` | NUMERIC > 0 |
| `trip_budget_currency` | VARCHAR(3) |
| `trip_budget_set_by` | UUID (Pro member who set) |
| `trip_budget_alert_80_sent` | boolean latch |
| `trip_budget_alert_100_sent` | boolean latch |

**Spend:** `SUM(expenses.amount)` where `group_id`, `currency = budget.currency`, `is_deleted = false`.

**Alerts:** After expense INSERT/UPDATE → `evaluate_trip_budget_alerts(group_id)` (SECURITY DEFINER). Insert `activity_events` kind `trip_budget_alert` for active members; reset latches when budget cleared/changed.

**Gating:** `set_group_trip_budget` requires `has_pro(auth.uid(), group_id)`; evaluation no-ops if Pro/Trip Pass expired for setter/group.

#### F. OCR pipeline

**Stages:**

1. **Capture** — existing `expo-image-picker` + receipt upload to `expense-receipts` bucket (private).
2. **OCR** — Supabase Edge `receipt-ocr`: JWT auth; accepts `text` (on-device OCR future) or `imageBase64`.
3. **Provider** — Optional `RECEIPT_OCR_API_URL` + `RECEIPT_OCR_API_KEY` (owner-supplied); **default: not configured**.
4. **Parse** — Shared heuristic `parseReceiptDraftFromText` (amount, currency, date, merchant) — unit tests in shared/mobile.
5. **Draft UX** — Pre-fill Add Expense; user always confirms before save.

**Security:** Edge function rate-limit per user; max payload size; no storage of images in function logs.

**Cost:** OCR external API per scan — Pro-gated; monitor invocations in Supabase dashboard.

### 1.3 Feature specs (concise)

| # | Feature | Primary UI | Server | Existing building blocks |
|---|---------|------------|--------|---------------------------|
| 1 | **Trip currency view** | Group detail or Balances | FX client-only | `GroupTripCurrencySection`, `tripCurrencyConversion`, `useExchangeRatesQuery` |
| 2 | **Smart payment reminders** | Settle Up list | Migration + cron RPC | `send_settle_reminder`, push pipeline, `get_group_pairwise_debts` |
| 3 | **Spending insights** | Group menu sheet | Analytics RPCs | Categories on `expenses`, group expenses query |
| 4 | **Trip budget + alerts** | Group detail | Budget RPC + trigger | Group totals patterns, `activity_events`, push kinds |
| 5 | **Receipt OCR** | Add expense receipt menu | `receipt-ocr` edge | Receipt upload, Add Expense form |

### 1.4 Data model & migrations (planned)

All migrations: idempotent patterns, `-- safe-breaking:` annotations where REVOKE/DROP CONSTRAINT, **dev first** (`drxfbicunusmipdgbgdk`), production via `deploy-production.yml` after validation.

| Migration theme | Objects |
|-----------------|--------|
| Smart reminders | `groups.smart_reminder_*`, `group_smart_reminder_recipient_state`, RPCs `set_group_smart_reminder`, `run_smart_payment_reminders` |
| Analytics | RPCs only (no new tables v1) |
| Budget | `groups.trip_budget_*`, `trip_budget_alert` activity kind, trigger on `expenses` |
| OCR | No DB schema required v1; optional `receipt_ocr_audit` table later for support |

**RLS:** New tables member-read; writes via SECURITY DEFINER RPCs only. Cron functions **service_role only**.

### 1.5 Edge functions

| Function | Auth | Schedule |
|----------|------|----------|
| `revenuecat-webhook` | Shared secret | RevenueCat POST |
| `send-push` | Webhook secret | DB trigger |
| `pro-trial-reminder-dispatch` | Webhook secret | Daily cron |
| `pro-smart-reminder-dispatch` | Webhook secret | Daily cron |
| `receipt-ocr` | User JWT | On demand |

Deploy checklist per function: secrets documented in `KUPAPAY_PRO_SETUP.md` / `RECEIPT_OCR.md`.

### 1.6 Client state & offline

| Feature | Online | Offline |
|---------|--------|---------|
| Trip currency | Live rates or cached FX | Cached rates only; upsell if locked |
| Smart reminders | Configure interval | Show last known setting; queue RPC on reconnect |
| Insights | RPC fetch | Hide or “offline” if no cached snapshot (v1: hide) |
| Budget | Edit budget + live progress | Show last budget; progress stale |
| Receipt scan | Edge OCR | Camera + attach photo; OCR when online |

React Query: invalidate pro status after purchase restore; invalidate group on budget/reminder settings change.

### 1.7 Performance budgets (initial)

| Operation | Target (p95) |
|-----------|----------------|
| `get_my_pro_status` | < 200 ms |
| Analytics RPC (≤5k expenses/group) | < 500 ms |
| Trip currency conversion (client) | < 50 ms |
| Receipt OCR edge (excl. provider) | < 3 s |

Load-test analytics RPC on dev with seeded large group before prod.

### 1.8 Security summary

- Pro admin RPCs: `has_pro` + `is_group_member`.
- Cron: no member impersonation; actor on reminders = `smart_reminder_set_by`.
- OCR: authenticated only; size limits; optional provider keys in Supabase secrets only.
- No PII in push metadata beyond existing patterns.
- Trip Pass: continue webhook idempotency (`revenuecat_webhook_events` pattern).

---

## Part 2 — Quality gates (before real payments & Pro v2 users)

**Goal:** No broad Pro v2 rollout until these gates are **defined, automated where possible, and green on `dev` for two consecutive release cycles.**

### 2.1 Current CI/CD audit (as of 2026-10-15)

| Workflow / check | Trigger | What it does | Gap for Pro v2 |
|------------------|---------|--------------|----------------|
| **CI / Lint** | PR → `dev`, `main`, `cursor/**` | `npm run lint` in monorepo | Does not lint Supabase SQL or Deno functions except RC webhook |
| **CI / Typecheck** | PR | shared + mobile `tsc` | Web app partial; edge functions not in TS gate |
| **CI / Mobile tests** | PR | Jest unit/component tests | No coverage threshold; no Detox/Maestro |
| **CI / RevenueCat webhook** | PR | `deno test` in `revenuecat-webhook/` | Other edge functions (send-push, receipt-ocr, crons) **not** in CI |
| **SonarCloud** | PR (GitHub integration) | Static analysis | Quality gate policy not documented in repo |
| **Deploy staging** | Push `dev` + migration paths | `supabase db push` → **development** | No automated smoke after push |
| **Deploy production** | Push `main` + migrations | `supabase-safe-migration-check.sh` then push → **production** | No dry-run against shadow DB; manual dispatch skips compat check |
| **TestFlight iOS** | `workflow_dispatch` | Local EAS build + ASC upload | Manual; optional `pro_enabled` input; **no automated smoke checklist** |
| **Vercel previews** | PR | Front-end deploy | Not gating mobile Pro flows |

**Branch protection (inferred):** `dev` requires Lint + Mobile tests (+ Sonar); auto-merge job on PRs to `dev`. **`main` merges manual** — appropriate for production.

### 2.2 Proposed quality gate program

#### Gate A — Unit tests

| Area | Requirement |
|------|-------------|
| Shared | 100% coverage on `hasPro*`, trip currency math, receipt parser, budget percent |
| Mobile | Component tests for each Pro surface (locked vs unlocked, RTL smoke) |
| Edge | Deno tests for every edge function handler (inject deps pattern like `pro-trial-reminder-dispatch`) |

**CI change:** Add jobs `deno-test-edge-functions` (matrix: send-push, receipt-ocr, crons) and **coverage report** upload (Jest `--coverage` + minimum threshold — propose **70% lines** on `packages/shared` and `apps/mobile/lib`, ratchet up).

#### Gate B — Integration tests (Supabase local + RLS)

**Today:** `cost-share-app/supabase/__tests/*.test.sql` exist but **are not run in CI**.

**Target:**

1. `supabase start` (or linked dev) in CI job on PR when `supabase/migrations/**` changes.
2. Apply migrations + run SQL tests via `supabase db test` or psql runner script.
3. **RLS suites** for new Pro RPCs: non-member denied, member without Pro denied on setters, member with Pro allowed, service_role cron allowed.

**Acceptance:** Migration PR cannot merge without green SQL integration job.

#### Gate C — Payment webhook contract tests

**Extend** `revenuecat-webhook/handler.test.ts`:

- Golden fixtures for: initial purchase, renewal, cancellation, Trip Pass with `group_id`, duplicate event id (idempotency), invalid signature.
- Assert RPC payload shapes match migration-defined functions.

**Optional:** Pact or snapshot HTTP tests against local edge serve.

#### Gate D — E2E tests (Maestro or Detox)

**Scope v1:** RevenueCat **sandbox** — not production payments.

| Flow | Tool | Notes |
|------|------|-------|
| Open paywall from locked export | Maestro | `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` dev build |
| Restore purchases (sandbox account) | Maestro | StoreKit configuration / RC sandbox user |
| Trip Pass attribute + group unlock | Maestro + seeded dev user | Verify `get_my_pro_status` UI badge |

Detox alternative if team prefers JS driver — pick **one** tool to avoid duplication.

**CI:** Nightly on `dev` (macOS runner or Maestro Cloud); not necessarily every PR due to cost.

#### Gate E — Migration safety

**Existing:** `supabase-safe-migration-check.sh` on production deploy (regex + `-- safe-breaking` escape).

**Add:**

| Step | Description |
|------|-------------|
| **Shadow schema** | Weekly job: restore prod schema snapshot to ephemeral DB (or Supabase branch), apply pending migrations from `dev`, run SQL integration suite |
| **Dry-run report** | Post PR comment with tables/columns added, new RPCs, new activity kinds |
| **Rollback plan** | Each Pro migration PR includes markdown rollback (drop trigger → drop RPC → drop columns) — forward-only preferred; document data loss |

**Manual dispatch warning:** Document that `workflow_dispatch` skips “new files” detection when `GITHUB_EVENT_BEFORE` empty.

#### Gate F — Staging environment

| Env | Branch | Supabase | Mobile build |
|-----|--------|----------|--------------|
| **Development** | `dev` | `drxfbicunusmipdgbgdk` | Dev client / internal |
| **Staging** | Tag or `release/*` | Same as dev **or** dedicated staging project (open question) | TestFlight with RC sandbox |
| **Production** | `main` | `jfqxjjjbpxbwwvoygahu` | App Store |

**Gate:** Pro v2 features enabled on staging builds for 1+ week before prod flag flip.

#### Gate G — Branch protections & required checks

**Recommend for `main`:**

- Required: Lint, Typecheck, Mobile tests, SonarCloud (quality gate pass), SQL integration (when migrations change), RevenueCat webhook Deno tests.
- Require PR review from owner for migration + payment touches.
- Block force-push.

**For `dev`:** Keep auto-merge but add SQL integration when migrations change.

#### Gate H — Coverage & Sonar

- Document Sonar quality gate in repo (`docs/SSOT/CODE QUALITY.md` pointer).
- Fail PR if duplication > threshold on copied SQL debt logic — extract shared SQL function for pairwise debts once.

#### Gate I — Release gates (TestFlight smoke checklist)

Manual checklist before promoting `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` on production build:

- [ ] Sign in (Google + Apple sample accounts)
- [ ] Paywall loads prices; Terms/Privacy links work
- [ ] Sandbox purchase → Pro unlocks export PDF
- [ ] Restore purchases
- [ ] Trip Pass purchase → group members see Pro (dev group)
- [ ] Webhook received (RC dashboard + `profiles.pro_until` row)
- [ ] Push token registered; test settle reminder still works
- [ ] Hebrew RTL: paywall + one Pro surface
- [ ] Offline: add expense still works; Pro surfaces degrade gracefully

Attach checklist to TestFlight workflow artifact or `docs/TESTFLIGHT_GITHUB_ACTIONS.md`.

#### Gate J — Monitoring & alerting

| Signal | Tool | Alert |
|--------|------|-------|
| Mobile crashes | Sentry (existing mock in Jest) | New release regression |
| Webhook failures | Supabase function logs + Sentry edge | Pager/email to owner |
| Webhook lag | RC dashboard + DB `revenuecat_webhook_events` stuck | Daily cron review |
| OCR cost | Supabase invocations metric | Budget alert |
| Cron silent failure | `pro-*-dispatch` returns 5xx | Log drain → email |

**Require:** RevenueCat webhook 4xx/5xx dashboard check in incident runbook.

#### Gate K — Incident runbook (payments)

1. **Detect:** User report / RC webhook errors / entitlement mismatch.  
2. **Triage:** Compare RC customer → Supabase `profiles.pro_until` / `group_passes`.  
3. **Mitigate:** Disable Pro flag in EAS env (instant kill switch); keep free tier usable.  
4. **Fix forward:** Replay webhook event id if idempotent handler allows; manual SQL only with owner on prod.  
5. **Communicate:** In-app banner if widespread; App Store refund policy link.  
6. **Post-mortem:** Update `KNOWN_ISSUES.md` + test fixture.

---

## Part 3 — Phased milestones (quality first)

### Phase 0 — Quality foundation (BLOCKING)

**Acceptance criteria:**

- [ ] SQL integration tests run in CI on migration changes; all existing `supabase/__tests__` included.
- [ ] Deno tests for `send-push`, `revenuecat-webhook`, and template for new edges documented.
- [ ] Webhook contract test suite covers idempotency + Trip Pass.
- [ ] Documented TestFlight smoke checklist executed once on `dev`.
- [ ] Sentry release tracking wired for mobile production builds.
- [ ] Owner sign-off on branch protections and Sonar gate.
- [ ] Shadow migration dry-run procedure documented and executed once.

**No Pro v2 feature code merges to `main` until Phase 0 sign-off.**

### Phase 1 — Trip currency view

**Depends on:** Phase 0.

**Deliverables:** Mount `GroupTripCurrencySection`; gating + paywall; FX offline behavior; EN/HE tests.

**Acceptance:**

- [ ] Multi-currency group shows conversion for Pro; upsell when flag on and not Pro.
- [ ] Single-currency group hides section when unlocked.
- [ ] Rates missing / offline copy verified.

### Phase 2 — Smart payment reminders

**Deliverables:** Group settings UI, migration, cron deploy doc, anti-spam tests, WhatsApp share.

**Acceptance:**

- [ ] Debtor receives ≤1 automated reminder per 3 days.
- [ ] Group interval respected.
- [ ] Stops when Pro/Trip Pass lapses.
- [ ] Push + in-app activity visible; deep link opens Settle Up.

### Phase 3 — Spending insights

**Deliverables:** SQL RPCs, sheet UI, default-currency scope documented.

**Acceptance:**

- [ ] Charts match SQL totals for seeded fixture group.
- [ ] Non-Pro sees upsell only when flag enabled.
- [ ] p95 RPC within budget on 5k expenses (dev load test).

### Phase 4 — Trip budget + alerts

**Deliverables:** Budget editor, trigger, new activity kind, send-push renderers, latch reset on budget change.

**Acceptance:**

- [ ] 80% and 100% fire exactly once per budget configuration.
- [ ] Push received by all active members (prefs permitting).
- [ ] Changing budget resets latches.

### Phase 5 — Receipt OCR

**Deliverables:** Edge function, parser tests, optional provider doc, Pro scan entry on Add Expense.

**Acceptance:**

- [ ] Without provider keys: photo saved, user informed, manual entry.
- [ ] With fixture text: draft fields pre-filled correctly (EN/HE receipts sample set).
- [ ] Rate limit prevents abuse.

### Phase 6 — Production Pro v2 launch

**Acceptance:**

- [ ] All phases on `dev` for ≥1 week stable.
- [ ] Migrations applied to prod with safe-check green.
- [ ] `EXPO_PUBLIC_KUPAPAY_PRO_ENABLED=true` on production EAS env.
- [ ] TestFlight smoke on prod RC keys.
- [ ] Monitoring dashboards active.

---

## Part 4 — Risks & open questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Webhook misconfiguration** | Paid users not unlocked | Contract tests + RC dashboard alerts + kill switch flag |
| **Cron over-notification** | User trust loss | 3-day floor, opt-in interval, easy Off |
| **FX API outage** | Trip currency wrong/missing | Cache + honest empty state |
| **OCR cost / abuse** | Bill shock | Pro gate, rate limits, optional provider |
| **Analytics on large groups** | Slow screens | SQL aggregation, indexes, pagination |
| **Migration on prod** | Old app breakage | safe-migration-check + shadow DB |
| **Sonar / Vercel noise** | Blocked merges | Clarify required checks vs advisory |
| **Duplicate `isProPerkUnlocked` across PRs** | Merge conflicts | Single shared PR first in Phase 1 |

### Open questions (owner / Naveh)

1. **Staging Supabase:** Separate project vs shared dev for pre-prod QA?  
2. **Smart reminders:** Legal/copy review for automated debt messages (HE/EN)?  
3. **Budget alerts:** Push to all members vs payer subset only?  
4. **Insights:** Default currency only v1 — confirm OK for multi-currency trips.  
5. **OCR vendor:** On-device ML Kit vs cloud-only vs hybrid? Budget for API?  
6. **Android Pro:** Parity timeline for Play Billing + RC sandbox E2E.  
7. **Coverage threshold:** Agree on 70% vs 80% for gate enforcement.  
8. **Maestro vs Detox:** Tool choice and cloud budget.  
9. **Trip Pass pricing:** Still TBD in store — blocks marketing copy finalization.  
10. **Phase 0 deadline:** Target sign-off date to start Phase 1 implementation?

---

## Appendix — Implementation PR order (after approval)

1. Phase 0 quality PRs (CI jobs, SQL test runner, docs).  
2. Phase 1 trip currency (single focused PR).  
3. Phase 2 reminders (migration + edge + mobile).  
4. Phase 3 insights (RPC + mobile).  
5. Phase 4 budget (migration + push kind + mobile).  
6. Phase 5 receipt OCR (edge + mobile + docs).

Each feature PR: tests, migration safe annotations, EN/HE, RTL screenshot in PR description, link to this plan section.

---

**Approval**

| Role | Name | Date | Approved |
|------|------|------|----------|
| Owner | | | ☐ |
| Engineering | | | ☐ |
