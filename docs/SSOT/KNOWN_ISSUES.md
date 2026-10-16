# Known Issues & Technical Gaps

**Status:** Living backlog (pre-launch and ongoing).  
**Language:** English only.

Track **bugs**, **regressions**, and **gaps** that should be fixed (or explicitly accepted before release).

This is **not** the same as:

| File | Owns |
|------|------|
| [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) | Intentional **deferrals** (What / Why / Revisit-when) |
| [CODE QUALITY.md](./CODE%20QUALITY.md) §6 | Small **architecture refactors** (`[PENDING REFACTOR]`) |
| GitHub Issues / PRs | Execution, discussion, assignees |

When a spec defers a feature by choice, log it in **TECHNICAL_DEBT.md**. When something is broken or missing and should be fixed, log it here.

---

## How to use

1. **Add** a row under the right priority table (or create a subsection).
2. **Link** spec, PR, or file path when known.
3. **Update status** when work starts or ships; move done items to [Resolved](#resolved) with date + PR.
4. **Do not** duplicate TECHNICAL_DEBT deferrals here unless there is an active bug (e.g. deferred feature shipped broken).

### Fields (per item)

| Field | Values |
|-------|--------|
| **ID** | `KI-###` (increment) |
| **Priority** | P0 (launch blocker) · P1 (soon) · P2 (polish) |
| **Status** | `open` · `in_progress` · `accepted` · `resolved` |
| **Area** | `mobile` · `web` · `supabase` · `i18n` · `ci` · `infra` |
| **SRS** | `REQ-*` if product-related |

---

## P0 — Launch blockers

| ID | Status | Area | Issue | Notes / fix direction |
|----|--------|------|-------|------------------------|
| KI-001 | resolved | mobile | **Invite redemption blocked during post-login onboarding** | Fixed 2026-06-02: `useAuthenticatedInviteRedemption` in gate + `pendingNavigation` flushed in `AppNavigator`. |
| KI-002 | resolved | mobile | **`fetchGroups` failure skips post-login onboarding** | Fixed 2026-06-02: fetch errors route to `create` gate (`lib/authenticatedGateResolve.ts`). |
| KI-003 | resolved | infra | **`assetlinks.json` served the wrong SHA-256 (Play Console reported domain/App Links as failed)** | Fixed 2026-07-09: `KUPAPAY_ANDROID_RELEASE_SHA256` (Supabase project secret, prod `jfqxjjjbpxbwwvoygahu`) held a stale value — neither fingerprint it produced matched Play Console's actual **App signing key certificate**, so Play Console flagged `kupa-pay.com` as "1 domain not verified" and the `/g/.*`/`/i/.*` web links as "Failed domain checks". `supabase/functions/invite-landing/well-known.ts` now hardcodes the confirmed correct SHA-256 (copied from Play Console → Setup → App signing) instead of trusting the env var; redeployed `invite-landing` (v17). Verified live at `https://kupa-pay.com/.well-known/assetlinks.json`. If the app signing key is ever rotated, update the `PLAY_APP_SIGNING_SHA256` constant in that file. |
| KI-004 | resolved | mobile | **9 TypeScript errors block `tsc --noEmit`** | Fixed 2026-06-02: added `isAdmin: false` to 4 User fixtures; removed invalid `role` from `mockGetGroupMembers.mockResolvedValueOnce` fixtures; chained `.then(() => undefined)` on `i18n.init()` to discharge the TFunction return; type-erased the `globalThis.crypto` polyfill via narrowed local alias. Also fixed a separate merge conflict in `hooks/queries/keys.ts` (both `adminPlatformMetrics` and `exchangeRates` keys preserved) and a stale `FriendBalance` fixture in `__tests__/lib/collectProfileFxCurrencies.test.ts` (added missing `name`/`isActive`/`sharedGroupIds`). `tsc --noEmit` now exits 0 for both `apps/mobile` and `packages/shared`. |
| KI-005 | partial | supabase | **Production missing migrations vs dev + missing prereq for `admin_platform_metrics`** | Prod (`jfqxjjjbpxbwwvoygahu`) has 5 migrations through `20260602130000`. Dev has 7 (`+ 20260602110734_revoke_sessions_on_delete`, `+ 20260602140000_admin_platform_metrics`). Auto-deployed on `main` push via `deploy-production.yml`. **Critical prereq filled 2026-06-02:** `20260602140000_admin_platform_metrics.sql` references `groups.last_activity_at` and `group_user_archive` — neither exists in prod (they live in the non-migration `supabase/group-archive.sql` that was MCP-applied to dev). Without the prereq, prod deploy would fail. Resolution: created `20260602135000_group_archive.sql` as a migration copy of `group-archive.sql` (idempotent — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`). Verified dev signatures match. **Remaining:** dry-run the chain (`20260602135000` → `140000` → `150000`) against a Supabase branch before merging dev → main. |
| KI-006 | partial | supabase | **17 `SECURITY DEFINER` functions executable by `anon` role** | Surgical fix added 2026-06-02 as migration `20260602150000_lockdown_security_definer.sql`. Revokes `anon` from 18 user/admin RPCs (`delete_my_account`, `get_my_open_balances`, `get_user_dashboard`, `get_user_balance_summary`, `get_activity_unread_count`, `get_group_messages`, `create/update/delete_group_message`, `accept/reject/send_friend_request`, `remove_friend`, `search_users`, `mark_activity_seen`, `admin_list_deleted_accounts`, `admin_restore_deleted_account`, `restore_deleted_account`) and grants only `authenticated`. Trigger-only functions (`emit_*_activity_events` × 5 + `check_email_not_deleted`) get full revoke — verified all 6 are wired to active triggers via `pg_trigger`; SECURITY DEFINER lets them fire as the owner. RLS helpers (`is_group_member`, `is_group_creator`, `is_caller_active`, `is_app_admin`) intentionally untouched. Migration dry-run validated against dev DB. **Remaining:** advisor will still flag the `authenticated` row (`authenticated_security_definer_function_executable`) — acceptable for now since these functions either need authenticated access (user RPCs) or check `is_app_admin()` internally (admin RPCs). |
| ~~KI-007~~ | retracted | mobile | ~~Android release build type points at debug keystore~~ | **Retracted 2026-06-02:** Not a blocker. `apps/mobile/android/` is fully gitignored (`.gitignore` line `/android`). EAS Build runs `expo prebuild` from scratch and injects the production keystore via `eas.json` credentials, overriding any local template. The local `signingConfig signingConfigs.debug` only affects `expo run:android --variant release` locally, which isn't used for store submissions. To permanently override the template would require an Expo config plugin — deferred. |

---

## P1 — Fix soon (post-launch acceptable only if tested)

| ID | Status | Area | Issue | Notes / fix direction |
|----|--------|------|-------|------------------------|
| KI-010 | open | mobile | **No automated tests for onboarding gate** | Coverage exists for `onboardingStorage`, `platformAlert`, `platformShare`; missing tests for `AuthenticatedAppGate`, `OnboardingPreAuthFlow`, `OnboardingCreateGroupScreen`, skip/create/error paths. |
| KI-011 | open | web | **Toast renders outside phone frame when authenticated** | In `App.tsx`, logged-in path places `Toast` outside `WebFrame`; logged-out path keeps it inside. Success/error toasts may span full browser width. |
| KI-012 | open | web | **`WebAlertHost` backdrop dismiss ignores Cancel** | Tapping outside modal calls `dismiss()` without `cancel` button `onPress`. Affects 3+ button alerts (e.g. receipt picker in `AddExpenseScreen`). File: `components/WebAlertHost.tsx`. |
| KI-013 | open | i18n | **Plural keys missing in `en.json`** | 16 `_many` / `_two` keys present in `he.json` but not `en` — risk of raw keys or wrong pluralization in English. |
| KI-014 | partial | ci | **Jest worker does not exit cleanly** | TanStack Query GC timers in `zombieSweep.test.ts` were a contributor — fixed with `gcTime: 0` + `QueryClient.clear()` in `afterEach`. Full suite still prints a force-exit warning (likely other suites); run `--detectOpenHandles` for remaining leaks. |
| KI-015 | resolved | ci | **CI runs lint + jest but no `tsc --noEmit`** | Fixed 2026-10-11: `npm run typecheck` (shared + mobile) and a **Typecheck** job in `.github/workflows/ci.yml`; PRs to `cursor/**` stacks now run CI. |
| ~~KI-016~~ | retracted | mobile | ~~5 i18n keys missing~~ | **Retracted 2026-06-02:** false positive from initial audit. All 5 keys (`balances.expenseCount`, `balances.paymentsToSettle`, `groups.expense.splitBetweenCount`, `groups.expense.toNPeople`, `groups.memberCount`) exist as pluralized forms (`_one`/`_other`/`_two`/`_many`) which i18next resolves via the `{count}` interpolator. Confirmed by dumping both locale files. |
| KI-017 | open | mobile | **`activity.service.ts` and `groups.service.ts` mix RPC-error-message string matching with structured handling** | E.g. `groups.service.ts:224` `error.message?.includes('has_balance')`; `deepLinks.service.ts:128-140` matches `'invite_not_found'` / `'cannot_self_invite'` strings. Brittle: any Postgres locale change or error wrapper breaks UX. RPCs should return a structured `{ ok, error_code }` object. |
| KI-018 | open | mobile | **`groups.service.ts` (641 LOC) and `messages.service.ts` have zero unit tests** | Both touched in recent commits (`8490d7b`, `2a368c3`). High blast radius — every screen uses `groups.service`. Add at minimum mocked-Supabase tests for `fetchGroups`, `getGroupBalances`, `getGroupDebts`, `fetchMessages`. |
| KI-019 | resolved | mobile | **`createExpense` / `updateExpense` non-atomic** | Fixed in Phase 1: `create_expense_with_splits` + `update_expense_with_splits` SECURITY DEFINER RPCs (`20260622130000`, `20261010200000`); mobile services call RPCs instead of multi-step inserts. |
| KI-030 | open | supabase | **`get_group_messages` signature drift between dev and prod** | Dev has `(uuid, integer, timestamptz)` — added manually via MCP, not in any migration or `schema.sql`. Prod has `(uuid, integer)` — matches `cost-share-app/supabase/group-messages.sql`. The 3-param version in dev has no source-of-truth file. Either (a) add a migration that introduces the `p_before` parameter so prod catches up, or (b) drop the 3-param dev override. `20260602150000_lockdown_security_definer.sql` works around this with a DO block that revokes/grants on whatever signature exists. |
| KI-031 | resolved | supabase | **`admin_list_support_messages` / `admin_update_support_message_status` missing admin gate** | Any authenticated user could read/update all support tickets via RPC. Fixed in `20261010230000_security_hardening.sql` + regression SQL test. |
| KI-032 | resolved | supabase | **Friend `profiles.invite_token` enumerable via public SELECT** | PostgREST returned `invite_token` for every profile row. Fixed: column ACL hides token; `get_my_invite_token()` for self; new tokens 14 chars (`generate_invite_token`). |
| KI-033 | resolved | supabase | **`expense-receipts` Storage bucket is public read** | Fixed 2026-10-11: private bucket + member SELECT RLS (`20261011011000`), DB URL→path migration, signed URLs in mobile + `apps/web/utils/expenseReceiptSignedUrl.ts`. Guard test: `apps/mobile/__tests__/guards/expenseReceiptsMigration.guard.test.ts`. |
| KI-034 | partial | supabase | **Account deletion: verify `auth.refresh_tokens.user_id` type on prod** | Session revocation covered by `delete_my_account.test.sql` + [DELETE_ACCOUNT_SESSION_REVOCATION.md](./DELETE_ACCOUNT_SESSION_REVOCATION.md). **Remaining:** run prod `information_schema` check after deploy. |

---

## P2 — Polish / tech hygiene

| ID | Status | Area | Issue | Notes / fix direction |
|----|--------|------|-------|------------------------|
| KI-020 | open | i18n | **`settleUp.swap` only in `en.json`** | Key unused in code today; add to `he.json` or remove from `en.json`. |
| KI-021 | open | mobile | **Language change in Settings does not reload app** | First launch seeds RTL via `Updates.reloadAsync()`; `changeLanguage` from Settings/Login only calls `forceRTL`. Most UI uses `useRtlLayout`; some native RTL may lag until restart. File: `i18n/index.ts`. |
| KI-022 | open | docs | **Onboarding spec vs implementation: 3 vs 4 feature slides** | Spec `docs/superpowers/specs/2026-06-01-onboarding-flow-design.md` says 3 slides; app has 4. Align spec or product, not a runtime bug. |
| KI-023 | resolved | mobile | **`console.log` in `initializeLanguage`** | Fixed 2026-06-02: wrapped both calls (`i18n/index.ts:118,136`) in `if (__DEV__)`. |
| KI-024 | accepted | mobile | **No “replay onboarding” in Settings** | Documented as not v1 in onboarding spec. |
| KI-025 | open | mobile | **RTL violations: `marginLeft`/`marginRight` and `textAlign:'left'` hardcoded in 10 component sites** | `components/CurrencyPicker.tsx:123`, `components/UnequalSplitPanel.tsx:169`, `components/AddMembersSheet.tsx:251`, `components/groupDetail/MemberStack.tsx:68`, `components/expenseV2/StackedAvatarGroup.tsx:25`, `components/FeedRowCard.tsx` (4×), `components/expenseV2/MemberPickerPopup.tsx`. Use `marginStart`/`marginEnd` and conditional `textAlign` (LegalDocumentSheet.tsx pattern). |
| KI-026 | open | mobile | **`toLocaleDateString()` called without `locale` argument** | `screens/expenses/ExpenseDetailScreen.tsx` and `screens/admin/AdminDeletedUsersScreen.tsx` — dates render in OS locale, not app language. Pass `i18n.language` (or `he-IL`/`en-US`). Reference correct pattern: `screens/balances/SettleUpListScreen.tsx:285`. |
| ~~KI-027~~ | retracted | supabase | ~~Prod auth: leaked password protection disabled~~ | **Retracted 2026-06-02:** N/A — the app uses Google OAuth exclusively (`auth.service.ts` only calls `signInWithOAuth` with provider `google`; no `signInWithPassword`/`signUpWithPassword` anywhere). Supabase advisor flags it generically but there are no passwords to protect. Revisit only if email/password sign-in is ever introduced. |
| KI-028 | resolved | supabase | ~~iOS AASA appID malformed: `.com.kupapay.mobile`~~ | Fixed via #42 (`fix(ios): correct AASA + appleTeamId to real Apple Team HVW3H3DLRB`). Verified 2026-07-09: `https://kupa-pay.com/.well-known/apple-app-site-association` now returns `appID: "HVW3H3DLRB.com.kupapay.mobile"`. |
| ~~KI-029~~ | retracted | mobile | ~~OAuth redirect URL logged in production~~ | **Retracted 2026-06-02:** false positive. Line 171 is inside an `if (__DEV__) { … }` block (line 170 opens the guard). All `console.info` calls in `auth.service.ts` are guarded; the lone `console.warn` (line 249) is on a real error path. |

---

## Pre-launch manual QA (checklist)

Use alongside automated tests before store / production cutover:

- [ ] Invite link → sign up → post-login onboarding → lands in correct group
- [ ] New user, airplane mode on first open after login → onboarding gate behavior
- [ ] Web: share invite, export group HTML, multi-button alerts
- [ ] Web: Toast position inside phone frame
- [ ] Hebrew device first launch → RTL reload; language toggle in Settings
- [ ] Skip pre- and post-login onboarding → no infinite loops; empty groups UX OK
- [ ] EAS production env: `EXPO_PUBLIC_SUPABASE_URL` contains **production** ref (`jfqxjjjbpxbwwvoygahu`), not dev
- [x] **After first EAS production build:** copy the App Signing key SHA-256 from Play Console → Setup → App signing into the `assetlinks.json` array; verify Android App Links auto-open via `adb shell pm verify-app-links --re-verify com.kupapay.mobile` (KI-003, resolved 2026-07-09).
- [ ] **Before merging dev → main:** review pending prod migrations `20260602110823_revoke_sessions_on_delete` + `20260602140000_admin_platform_metrics` against prod data (KI-005).
- [ ] **TS gate:** run `npm run tsc -- --noEmit` from `apps/mobile` and confirm 0 errors (KI-004 + KI-015).

---

## Resolved

| ID | Resolved | PR / notes |
|----|----------|------------|
| KI-001 | 2026-06-02 | `useAuthenticatedInviteRedemption`, `pendingNavigation` store, `usePendingNavigationFlush` |
| KI-002 | 2026-06-02 | `resolveAuthenticatedGateTarget` — `fetchFailed` → `create` |
| KI-004 | 2026-06-02 | Test fixtures `isAdmin` + remove invalid `role`; i18n init return type; polyfillWebCrypto typing; merge-conflict in `hooks/queries/keys.ts`; FriendBalance fixture in `collectProfileFxCurrencies.test.ts`. |
| KI-023 | 2026-06-02 | Guarded `console.log` in `i18n/index.ts` with `if (__DEV__)`. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-02 | Initial backlog from pre-launch mobile audit (onboarding, web platform adapters). |
| 2026-06-02 | Resolved KI-001, KI-002 (authenticated gate + invite redemption). |
| 2026-06-02 | Added KI-003..007 (P0), KI-015..019 (P1), KI-025..029 (P2) from pre-Google-Play release audit (deep-link infra, TS errors, migration drift, SECURITY DEFINER exposure, Android signing, CI gap, missing i18n keys, RTL nits, service gaps, atomicity, AASA appID, advisor flags). |
| 2026-06-02 | Resolved KI-004 (TS errors), KI-023 (console logs); partial KI-005 (added `20260602135000_group_archive.sql` migration prereq); partial KI-006 (added `20260602150000_lockdown_security_definer.sql` migration — dry-run passed on both dev and prod). |
| 2026-06-02 | Retracted KI-007 (Android `/android` folder is gitignored — EAS overrides), KI-016 (pluralized keys not missing), KI-027 (no email/password auth in app), and KI-029 (OAuth log already `__DEV__`-guarded). |
| 2026-06-02 | Added KI-030 (`get_group_messages` 3-vs-2-param dev/prod drift; lockdown migration handles via DO block). |
| 2026-10-11 | Security/CI pass: resolved KI-015, KI-019, KI-031, KI-032; partial KI-014; added KI-033–034. |
