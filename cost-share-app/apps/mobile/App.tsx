import './lib/sentry';
import { finishAppBootSpan } from './lib/appBootPerformance';

import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, type AppStateStatus, Appearance, LogBox, View, Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { applySentryUser, applySentryLanguage } from './lib/sentryIdentity';
import Toast from 'react-native-toast-message';
import { toastConfig } from './lib/toastConfig';
import { handleAuthRedirectUrl, isAuthCallbackUrl } from './services/auth.service';
import { AuthenticatedAppGate } from './components/AuthenticatedAppGate';
import { LoginScreen } from './screens/auth/LoginScreen';
import { PublicSupportScreen } from './screens/auth/PublicSupportScreen';
import { OnboardingPreAuthFlow } from './screens/onboarding/OnboardingPreAuthFlow';
import { hasCompletedPreLoginOnboarding } from './lib/onboardingStorage';
import { initializeLanguage } from './i18n';
import {
  clearStaleAuthSession,
  hydrateAuthSession,
  isInvalidRefreshTokenError,
  setupSupabaseAuthAutoRefresh,
} from './lib/authSessionLifecycle';
import { syncRealtimeAuth } from './lib/realtimeAuth';
import { syncPushRegistrationOnSignIn, clearPushRegistrationOnSignOut } from './lib/pushRegistrationLifecycle';
import { configureNativeGoogleSignIn } from './lib/googleSignInNative';
import { supabase } from './lib/supabase';
import { assertProfileActiveWithTimeout } from './lib/auth';
import { signalDeactivatedAccount } from './lib/signalDeactivatedAccount';
import { clearDeactivationNoticePending } from './lib/deactivationNoticeStorage';
import { acceptSessionIfAllowed as acceptSessionIfAllowedImpl } from './lib/acceptSessionIfAllowed';
import { queryClient } from './lib/queryClient';
import { restoreClient } from './lib/persistQueryClient';
import { wireNetworkStatusToOnlineManager } from './lib/networkStatus';
import { sweepIfOnline } from './lib/zombieSweep';
import { AppGateSkeleton } from './components/skeletons/AppGateSkeleton';
import { useAppStore } from './store';
import { useAppRealtime } from './hooks/useAppRealtime';
import { useBootWatchdog } from './hooks/useBootWatchdog';
import { colors } from './theme';
import { RtlLayoutProvider } from './hooks/useRtlLayout';
import {
    captureProductEvent,
    identifyProductUser,
    isNewAccountSignup,
    resetProductAnalyticsUser,
    trackSignupCompleted,
} from './lib/productAnalytics';
import { PostHogAnalyticsProvider } from './components/PostHogAnalyticsProvider';
import { capturePreAuthInvite } from './lib/capturePreAuthInvite';
import { loadPersistedPendingInvite } from './lib/pendingInviteStorage';
import { recoverDeferredInviteAttribution } from './lib/recoverDeferredInviteAttribution';
import {
    applyStoredMarketingAttributionToPostHog,
    bootstrapMarketingAttribution,
} from './lib/marketingAttribution';
import { recordAppLaunchForStoreReview } from './lib/storeReviewPrompt';
import { configureRewardedAdsSdk } from './lib/configureRewardedAdsSdk';
import { WebAlertHost } from './components/WebAlertHost';
import { AppExitGuard } from './components/AppExitGuard';
import { UpdateRequiredScreen } from './screens/UpdateRequiredScreen';
import {
    evaluateMinimumAppVersion,
    type AppClientConfig,
} from './services/appClientConfig.service';
import type { Session } from '@supabase/supabase-js';
import './global.css';
import { isAscScreenshotDemo } from './lib/ascScreenshotDemo';
import { AscStoreListingCaptureRoot } from './screenshotDemo/AscStoreListingCaptureRoot';
import { GroupCardListPreviewScreen } from './screens/dev/GroupCardListPreviewScreen';
import { GroupsListB2PreviewScreen } from './screens/dev/GroupsListB2PreviewScreen';
import { SettingsRowLayoutPreviewScreen } from './screens/dev/SettingsRowLayoutPreviewScreen';
import { readGroupsListPreviewParams } from './dev/groupsListPreviewParams';

function isGroupCardPreviewMode(): boolean {
  if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') return false;
  return new URLSearchParams(globalThis.location.search).get('devGroupCardPreview') === '1';
}

function isGroupsListB2PreviewMode(): boolean {
  if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') return false;
  return new URLSearchParams(globalThis.location.search).get('devGroupsListB2Preview') === '1';
}

function isSettingsRowPreviewMode(): boolean {
  if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') return false;
  return new URLSearchParams(globalThis.location.search).get('devSettingsRowPreview') === '1';
}

// Benign when a persisted session was revoked server-side (global sign-out, token rotation, etc.).
LogBox.ignoreLogs([/Invalid Refresh Token/i, /Refresh Token Not Found/i]);

// Keep splash visible until init finishes; we hide it explicitly below.
SplashScreen.preventAutoHideAsync().catch(() => {});

// On web, frame the app in a phone-shaped column so mobile screens don't stretch across the browser.
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  const b2Preview = isGroupsListB2PreviewMode();
  const preview = b2Preview ? readGroupsListPreviewParams() : null;
  const isDark = preview?.theme === 'dark';
  const maxWidth = preview?.narrow ? 320 : 430;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: isDark ? '#030712' : '#0f172a',
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          backgroundColor: isDark ? '#111827' : '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 0 24px rgba(0,0,0,0.25)',
        }}
      >
        <WebAlertHost />
        {children}
      </View>
    </View>
  );
}

function App() {
  const appOpenedSentRef = React.useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [preOnboardingDone, setPreOnboardingDone] = useState<boolean | null>(null);
  const [forcedUpdateConfig, setForcedUpdateConfig] = useState<AppClientConfig | null>(null);
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const currentUser = useAppStore((s) => s.currentUser);
  const currentUserId = currentUser?.id ?? null;
  const language = useAppStore((s) => s.language);
  useAppRealtime(currentUserId);
  const setPendingDeactivationNotice = useAppStore((s) => s.setPendingDeactivationNotice);
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    applySentryUser(currentUser ?? null);
  }, [currentUser]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (isGroupsListB2PreviewMode()) return;
    const apply = (scheme: 'light' | 'dark' | null | undefined) => {
      document.documentElement.classList.toggle('dark', scheme === 'dark');
    };
    apply(Appearance.getColorScheme());
    const sub = Appearance.addChangeListener(({ colorScheme }) => apply(colorScheme));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const user = session?.user;
    if (!user?.id) return;
    void identifyProductUser(user.id);
    void applyStoredMarketingAttributionToPostHog(user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isReady || !session || appOpenedSentRef.current) return;
    appOpenedSentRef.current = true;
    void captureProductEvent('app_open');
  }, [isReady, session]);

  useEffect(() => {
    if (!isReady) return;
    void recordAppLaunchForStoreReview();
  }, [isReady]);

  const setPendingInvite = useAppStore((s) => s.setPendingInvite);

  useEffect(() => {
    if (session || !incomingUrl) return;
    void capturePreAuthInvite(incomingUrl, setPendingInvite);
  }, [incomingUrl, session, setPendingInvite]);

  useEffect(() => {
    if (session) return;
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      void capturePreAuthInvite(url, setPendingInvite);
    });
    return () => {
      cancelled = true;
    };
  }, [session, setPendingInvite]);

  useEffect(() => {
    if (currentUserId) void syncPushRegistrationOnSignIn();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    void import('./services/purchases.service').then(({ configurePurchasesForUser }) =>
      configurePurchasesForUser(currentUserId),
    );
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) return;
    void import('./services/purchases.service').then(({ logOutPurchases }) => logOutPurchases());
  }, [currentUserId]);

  useEffect(() => {
    applySentryLanguage(language);
  }, [language]);

  const rejectDeactivatedSession = useCallback(async () => {
    void signalDeactivatedAccount(setPendingDeactivationNotice);
    await clearStaleAuthSession();
    setSession(null);
  }, [setPendingDeactivationNotice, setSession]);

  const processOAuthCallbackUrl = useCallback(async (url: string) => {
    const { error } = await handleAuthRedirectUrl(url);
    if (error?.code === 'account_restorable') {
      useAppStore.getState().setPendingAccountRestore(true);
      useAppStore.getState().setSession(null);
      return error;
    }
    if (error?.code === 'account_deleted') {
      await rejectDeactivatedSession();
    }
    return error;
  }, [rejectDeactivatedSession]);

  // Web: OAuth returns in the same browser tab via useURL.
  useEffect(() => {
    if (Platform.OS !== 'web' || !incomingUrl || !isAuthCallbackUrl(incomingUrl)) return;
    void processOAuthCallbackUrl(incomingUrl);
  }, [incomingUrl, processOAuthCallbackUrl]);

  // Native: cold-start deep links only (in-app OAuth is handled in signInWithGoogle).
  useEffect(() => {
    if (Platform.OS === 'web' || session) return;

    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url || !isAuthCallbackUrl(url)) return;
      void processOAuthCallbackUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [session, processOAuthCallbackUrl]);

  const guardSession = useCallback(async () => {
    const status = await assertProfileActiveWithTimeout();
    if (status === 'deactivated') {
      await rejectDeactivatedSession();
    }
  }, [rejectDeactivatedSession]);

  // Boot-only: do not list auth callbacks in deps — they must not re-run init and stack listeners.
  useEffect(() => {
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      const store = useAppStore.getState();

      const acceptSession = (nextSession: Session | null, mode: 'fresh' | 'hydration') =>
        acceptSessionIfAllowedImpl(nextSession, mode, {
          setSession: store.setSession,
          setPendingDeactivationNotice: store.setPendingDeactivationNotice,
          setPendingAccountRestore: store.setPendingAccountRestore,
        });

      const processOAuth = async (url: string) => {
        const { error } = await handleAuthRedirectUrl(url);
        if (error?.code === 'account_restorable') {
          store.setPendingAccountRestore(true);
          store.setSession(null);
          return;
        }
        if (error?.code === 'account_deleted') {
          await signalDeactivatedAccount(store.setPendingDeactivationNotice);
          await clearStaleAuthSession();
          store.setSession(null);
        }
      };

      try {
        await initializeLanguage();

        const versionGate = await evaluateMinimumAppVersion();
        if (!mounted) return;
        if (versionGate.status === 'update_required') {
          setForcedUpdateConfig(versionGate.config);
          return;
        }

        configureNativeGoogleSignIn();
        await configureRewardedAdsSdk();
        const preDone = await hasCompletedPreLoginOnboarding();
        if (mounted) setPreOnboardingDone(preDone);

        if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined') {
          const callbackUrl = globalThis.location.href;
          if (isAuthCallbackUrl(callbackUrl)) {
            await processOAuth(callbackUrl);
            globalThis.history.replaceState({}, '', '/');
          }
        }

        const hydratedSession = await hydrateAuthSession();
        if (!mounted) return;

        await restoreClient();

        const persistedInvite = await loadPersistedPendingInvite();
        if (persistedInvite) {
            store.setPendingInvite(persistedInvite);
        } else {
            const recovered = await recoverDeferredInviteAttribution(false);
            if (recovered) {
                store.setPendingInvite(recovered);
            }
        }

        // supabase-js only auths Realtime on SIGNED_IN / TOKEN_REFRESHED, not on
        // the INITIAL_SESSION a cold-start restore emits — so live updates
        // (expenses, settlements, activity) wouldn't arrive until the next token
        // refresh. Set Realtime auth explicitly from the restored session, and
        // BEFORE acceptSession (which sets currentUser and mounts the realtime
        // channels) so the socket is authenticated before any channel joins.
        syncRealtimeAuth(hydratedSession);

        if (hydratedSession) {
          await acceptSession(hydratedSession, 'hydration');
        } else {
          store.setSession(null);
          // Drop persisted flags so a cold start never shows the deleted-account
          // dialog without a fresh sign-in attempt.
          await clearDeactivationNoticePending();
        }

        setupSupabaseAuthAutoRefresh();
        void bootstrapMarketingAttribution();

        // Register after hydrateAuthSession so we are the only boot-time listener and
        // do not clear the store on a premature null before AsyncStorage is read.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (event === 'INITIAL_SESSION') return;

          if (event === 'SIGNED_OUT') {
            useAppStore.getState().setSession(null);
            void clearPushRegistrationOnSignOut();
            void resetProductAnalyticsUser();
            return;
          }

          if (!nextSession) return;

          if (event === 'SIGNED_IN') {
            if (isNewAccountSignup(nextSession.user)) {
              const provider = nextSession.user.app_metadata?.provider ?? 'unknown';
              void captureProductEvent('signup', { provider });
              void trackSignupCompleted({ provider });
            }
            setTimeout(() => {
              void acceptSession(nextSession, 'fresh');
            }, 0);
            return;
          }

          if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            useAppStore.getState().setSession(nextSession);
          }
        });
        authSubscription = subscription;
      } catch (e) {
        if (isInvalidRefreshTokenError(e)) {
          await clearStaleAuthSession();
          if (mounted) useAppStore.getState().setSession(null);
        } else {
          console.error('Init error:', e);
        }
        setupSupabaseAuthAutoRefresh();
      } finally {
        finishAppBootSpan();
        if (mounted) setIsReady(true);
      }
    };

    void init();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  // Safety net: never let a hung boot step strand the user on the native splash.
  // init() is already fully bounded, so this only matters if that ever regresses.
  const markReady = useCallback(() => setIsReady(true), []);
  useBootWatchdog(isReady, markReady);

  useEffect(() => {
    // Hide the native (static) splash on the first JS frame so the animated
    // AppGateSkeleton loading screen is visible during boot. Previously this
    // waited for `isReady`, so the static splash covered the skeleton for the
    // whole load and the brand animation was never seen on native.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = wireNetworkStatusToOnlineManager();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void guardSession();
        sweepIfOnline(queryClient);
      }
    });
    return () => sub.remove();
  }, [guardSession]);

  if (isAscScreenshotDemo()) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <AscStoreListingCaptureRoot />
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (forcedUpdateConfig) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <UpdateRequiredScreen config={forcedUpdateConfig} />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (isGroupCardPreviewMode()) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <GroupCardListPreviewScreen />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (isGroupsListB2PreviewMode()) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <GroupsListB2PreviewScreen />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (isSettingsRowPreviewMode()) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <SettingsRowLayoutPreviewScreen />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <AppGateSkeleton />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    const showPreOnboarding = preOnboardingDone === false;
    const isPublicSupportPath =
      Platform.OS === 'web' &&
      typeof globalThis.location !== 'undefined' &&
      globalThis.location.pathname.replace(/\/{1,256}$/, '') === '/support';

    return (
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            {isPublicSupportPath ? (
              <PublicSupportScreen />
            ) : preOnboardingDone === null ? (
              <AppGateSkeleton />
            ) : showPreOnboarding ? (
              <OnboardingPreAuthFlow onFinished={() => setPreOnboardingDone(true)} />
            ) : (
              <LoginScreen />
            )}
            <Toast config={toastConfig} topOffset={56} />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RtlLayoutProvider>
          <WebFrame>
            <AuthenticatedAppGate />
            <Toast config={toastConfig} topOffset={56} />
          </WebFrame>
        </RtlLayoutProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function Root() {
  return (
    <PostHogAnalyticsProvider>
      <AppExitGuard />
      <App />
    </PostHogAnalyticsProvider>
  );
}

export default Sentry.wrap(Root);
