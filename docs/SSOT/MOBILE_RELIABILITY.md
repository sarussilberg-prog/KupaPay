# Mobile reliability (#427)

**Platforms:** iOS and Android (Expo dev client / store builds). Expo Web shares the same error-handling patterns via `handleError` + i18n toast keys.

## Crash-free sessions (Sentry Release Health)

- `release` + `dist` come from `sentryReleaseMetadata()` (`apps/mobile/lib/sentryRelease.ts`).
- `enableAutoSessionTracking: true` in `apps/mobile/lib/sentry.ts`.
- Monitor **Crash Free Session Rate** in Sentry → Releases (target **≥ 99.5%**).

## Offline add expense

- Optimistic pending rows (`pending_*` ids) + React Query persist (`shouldDehydrateMutationFactory` keeps paused `addExpense` mutations).
- User copy: `expenses.offlineMessage` / group detail offline strings (7 locales).
- Failed sync sets `pendingFailed` on the row and captures Sentry tag `mutation.offline_add`.

## Graceful errors

Use `handleError()` for user-visible failures — always pass `toast.titleKey` / `messageKey` so strings stay localized (RTL-safe via i18n).
