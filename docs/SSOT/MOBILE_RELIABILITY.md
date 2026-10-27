# Mobile reliability (#427)

**Platforms:** iOS, Android, and Expo Web (shared React Native tree). Next.js marketing site uses the same Sentry release-health pattern in `apps/web/lib/sentryInit.ts`.

## Crash-free sessions (Sentry Release Health)

- `release` + `dist` come from `sentryReleaseMetadata()` (`apps/mobile/lib/sentryRelease.ts`).
- `enableAutoSessionTracking: true` in `apps/mobile/lib/sentry.ts`.
- `@sentry/nextjs` with `release` + `dist` (browser sessions / Release Health when DSN is set).
- Monitor **Crash Free Session Rate** in Sentry → Releases (target **≥ 99.5%**).

## Screen error boundaries

- Every authenticated navigator route is wrapped via `navigation/boundScreen.tsx` → `ScreenErrorBoundary`.
- Auth / gate screens (`Login`, pre-auth onboarding, `PublicSupport`, `UpdateRequired`, `ActivationOnboarding`) are wrapped in `App.tsx` / `AuthenticatedAppGate.tsx`.
- Fallback copy: `common.screenErrorTitle` / `common.screenErrorMessage` (7 locales, RTL-safe).
- Render errors are reported to Sentry with tag `screen.error_boundary`.

## Offline UX

- **Banner:** `NetworkOfflineBanner` under `AdminProViewBanner` when `onlineManager` is offline; **Retry** runs `retryConnectivitySync()` (resume paused mutations + refetch active queries).
- **Auto-sync:** `AuthenticatedAppGate` calls `retryConnectivitySync` when the device transitions offline → online.
- **Persisted cache:** `lib/persistQueryClient.ts` (SuperJSON, allowlisted query keys, paused `addExpense` mutations).
- User copy: `common.offlineBannerMessage`, `common.offlineTitle`, `expenses.offlineMessage`, etc. (7 locales).

## Offline add expense

- Optimistic pending rows (`pending_*` ids) + React Query persist (`shouldDehydrateMutationFactory` keeps paused `addExpense` mutations).
- Failed sync sets `pendingFailed` on the row and captures Sentry tag `mutation.offline_add`.

## Graceful errors

Use `handleError()` for user-visible failures — always pass `toast.titleKey` / `messageKey` so strings stay localized (RTL-safe via i18n).

## Null-safe route params

- `GroupDetailScreen` accepts optional `groupId` prop (Favorite tab) and renders a load error empty state when id is missing.
- `ExpenseDetailScreen` guards missing `expenseId` / `groupId` before fetch and render.
