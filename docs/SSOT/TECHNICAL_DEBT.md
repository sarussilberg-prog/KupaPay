# Technical Debt

Items deferred from active development, with rationale and trigger conditions for revisiting.

This file is the single source of truth for "we chose not to build X now". When a spec defers something, it should be logged here.

**Bugs and active gaps** (things that should work but don't) belong in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md), not here.

---

## Notifications (deferred from 2026-05-20 spec)

Source spec: `docs/superpowers/specs/2026-05-20-notifications-design.md`

### 1. Proactive debt reminders (`debt.reminder`)
- **What:** Scheduled push when a debt remains open for N days.
- **Why deferred:** Requires `pg_cron` job + debt aging logic + per-pair cooldowns. Builds on stable reactive notifications; better to ship the core first and validate.
- **Revisit when:** Phase 4 GA stable for 4 weeks AND user research confirms unpaid debts as a top-3 friction.

### 2. Quiet hours (e.g., 22:00–08:00)
- **What:** User-configurable time window where push is muted (in-app still arrives).
- **Why deferred:** iOS Focus modes cover most users; adding this requires timezone storage + per-user schedule UI.
- **Revisit when:** ≥5 user-reported requests OR Android-heavy region expansion (Android Focus is weaker).

### 3. Gender-aware Hebrew translations
- **What:** "הוסיף" vs "הוסיפה" based on actor's gender.
- **Why deferred:** No `gender` field on profiles yet. Current fallback "הוסיף/ה" is acceptable but not polished.
- **Revisit when:** `profiles` gain a `gender` field for other reasons, OR user feedback flags this.

### 4. Expo Push Receipts polling
- **What:** Async confirmation that push reached APNs/FCM (15-min delay job).
- **Why deferred:** `DeviceNotRegistered` is handled in the immediate response already; receipts add ~10% delivery confidence at the cost of another scheduled job.
- **Revisit when:** Observed silent-failure rate > 2%.

### 5. "Hide content on lock screen" user toggle
- **What:** Replace push body with generic text for privacy-conscious users.
- **Why deferred:** OS-level setting exists; only worth building if users complain.
- **Revisit when:** Privacy-related support tickets > 3 in a month.

### 6. Temporary mute (`muted_until` UI)
- **What:** "Mute for 1 hour / 1 day / 1 week" — schema supports it (`notification_mutes.muted_until`), UI doesn't expose it.
- **Why deferred:** Schema-ready, UI work small but not v1-critical.
- **Revisit when:** Phase 4 stable.

### 7. Web push notifications
- **What:** Browser push for the web app.
- **Why deferred:** Web is auth + landing surface, not primary engagement.
- **Revisit when:** Web becomes a primary surface (dashboards, etc.).

---

## Observability & ops (deferred from 2026-06-02 pre-Play audit)

### 1. Crash & error reporting (Sentry / Crashlytics)
- **Status (2026-10-15):** **Shipped** — `@sentry/react-native` (EU DSN), release/dist tagging, `sendDefaultPii: false`, user id only. Source-map upload runs on EAS when `SENTRY_AUTH_TOKEN` is set; otherwise `SENTRY_DISABLE_AUTO_UPLOAD=true` from `app.config.ts`.
- **Revisit when:** First prod crash where stack is still minified (verify token + upload).

### 2. Product analytics (PostHog / Amplitude / similar)
- **Status (2026-10-15):** **Shipped (Phase 1)** — `posthog-react-native` + `productAnalytics.ts` wrapper (EU host, no replay/autocapture/PII); funnel events through paywall/purchases/invites. Privacy policy (`20261010210000`+).
- **Status (2026-10-16):** Funnel taxonomy + cross-platform context tags (#421); north-star SQL + HogQL templates (#422). See [POSTHOG_EVENT_TAXONOMY.md](./POSTHOG_EVENT_TAXONOMY.md).
- **Revisit when:** PostHog UI dashboards manually duplicated from HogQL templates if not yet created in EU project.

### 3. CI: TypeScript strict gate + workspace `tsc` in `ci.yml`
- **Status (2026-10-11):** **Done** — KI-015 resolved; `npm run typecheck` in CI (see security stack PR).

### 4. RLS performance optimization at scale (`auth.uid()` → `(SELECT auth.uid())`)
- **What:** Wrap every `auth.uid()` call inside RLS policies in `(SELECT …)` to prevent per-row re-evaluation. Supabase advisor flags ~12 policies on prod (`profiles`, `groups`, `settlements`, `group_members`, `friendships`, `friend_requests`, `friend_blocks`, `group_messages`, `activity_events`).
- **Why deferred:** Cosmetic until tables grow. At internal-tester scale (~10 rows/table) the difference is unmeasurable. Worth a bulk migration before public launch when group counts climb.
- **Revisit when:** Any single user has > 50 groups, OR any group has > 500 expenses, OR p95 query time on `groups`/`expenses` SELECTs exceeds 200ms in prod logs.

### 5. RPC error-code contract
- **What:** Migrate Postgres RPCs (especially `redeem_group_invite`, `delete_my_account`, `delete_group`) from raising exceptions with English message strings to returning `JSONB { ok, error_code, message? }`. Clients today match `error.message?.includes('has_balance')` / `'invite_not_found'` / `'cannot_self_invite'` (KI-017), which is brittle.
- **Why deferred:** Touches every RPC + every service caller + every error toast. Not a beta blocker — the strings work today. Worth doing once we add a second client (e.g. web shell).
- **Revisit when:** A Postgres upgrade changes an error format, OR we add a second consumer of these RPCs, OR i18n on RPC errors becomes a release requirement.

### 6. Atomic multi-table writes via SECURITY DEFINER RPCs
- **Status (2026-10-11):** **Partial** — `create_expense_with_splits` + `update_expense_with_splits` shipped (KI-019 resolved). Settlement + invite flows still worth auditing for remaining multi-step client paths.
- **Revisit when:** Any new orphan-row incident, or before scaling concurrent editors in one group.

### 7. Pagination on `fetchMessages` / activity feed
- **What:** `messages.service.ts` calls `get_group_messages` with hardcoded `p_limit: 100`. No cursor / `offset`. Activity feed has similar full-fetch pattern.
- **Why deferred:** No group has > 100 messages today. Pagination + `hasMore` flag is the right pattern but premature without real users.
- **Revisit when:** Any internal group has > 80 messages, OR scroll perf on `GroupNoteScreen` degrades.

### 8. Drop unused indexes flagged by Supabase advisor
- **What:** 14 indexes flagged as never-used on prod: `idx_groups_created_by`, `idx_groups_is_active`, `idx_group_members_group`, `idx_expenses_paid_by`, `idx_expenses_created_by`, `idx_expenses_date`, `idx_expenses_category`, `idx_expense_splits_user`, `idx_settlements_group`, `idx_settlements_from_user`, `idx_settlements_to_user`, `idx_settlements_date`, `idx_profiles_is_active`, `idx_activity_events_user_kind_created`, `legal_documents_lookup`.
- **Why deferred:** They cost write overhead but are harmless. Dropping prematurely risks slow queries we haven't observed yet because we don't have prod traffic.
- **Revisit when:** First prod traffic baseline (4 weeks of real usage) shows the queries that would use them still don't fire.

---

## Invitations & Sharing (deferred from 2026-05-20 spec)

Source spec: `docs/superpowers/specs/2026-05-20-invites-and-sharing-design.md`

### 1. Single-use / expiring invite tokens
- **What:** Tokens that auto-invalidate after one use or after N hours.
- **Why deferred:** Multi-use is simpler and matches the WhatsApp share use-case. Adds value mostly under security review.
- **Revisit when:** Security review flags rotation alone as insufficient, OR user request volume justifies it.

### 2. Push notification for pending invites
- **What:** Push to inviter when their invite is redeemed.
- **Why deferred:** Folded into the notifications spec — implemented there as `member_joined`.
- **Status:** Resolved by notifications spec (Phase 2).

---

## How to use this file

- **When deferring something:** add an entry with What / Why / Revisit-when triplet.
- **When picking up something:** move the item out (delete from this file, mention in the spec/PR that picks it up).
- **Triggers, not deadlines:** items live here until a real condition (user feedback, metric threshold, complementary feature) makes it worth the cost. Time-based "we'll get to it" entries rot.
