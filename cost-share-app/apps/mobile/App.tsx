import './lib/sentry';

import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, type AppStateStatus, LogBox, View, Platform } from 'react-native';
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
import { WebAlertHost } from './components/WebAlertHost';
import type { Session } from '@supabase/supabase-js';
import './global.css';

// Benign when a persisted session was revoked server-side (global sign-out, token rotation, etc.).
LogBox.ignoreLogs([/Invalid Refresh Token/i, /Refresh Token Not Found/i]);

// Keep splash visible until init finishes; we hide it explicitly below.
SplashScreen.preventAutoHideAsync().catch(() => {});

// On web, frame the app in a phone-shaped column so mobile screens don't stretch across the browser.
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#0f172a' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          backgroundColor: '#ffffff',
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
  const [isReady, setIsReady] = useState(false);
  const [preOnboardingDone, setPreOnboardingDone] = useState<boolean | null>(null);
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
    if (currentUserId) void syncPushRegistrationOnSignIn();
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
        });

      const processOAuth = async (url: string) => {
        const { error } = await handleAuthRedirectUrl(url);
        if (error?.code === 'account_deleted') {
          void signalDeactivatedAccount(store.setPendingDeactivationNotice);
          await clearStaleAuthSession();
          store.setSession(null);
        }
      };

      try {
        configureNativeGoogleSignIn();
        await initializeLanguage();
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
        }

        setupSupabaseAuthAutoRefresh();

        // Register after hydrateAuthSession so we are the only boot-time listener and
        // do not clear the store on a premature null before AsyncStorage is read.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (event === 'INITIAL_SESSION') return;

          if (event === 'SIGNED_OUT') {
            useAppStore.getState().setSession(null);
            void clearPushRegistrationOnSignOut();
            return;
          }

          if (!nextSession) return;

          if (event === 'SIGNED_IN') {
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
    if (isReady) SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

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

  if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined' && globalThis.location.pathname === '/.well-known/apple-app-site-association') {
    const aasa = {
      applinks: {
        apps: [],
        details: [{ appID: 'K3M6R85KA6.com.kupapay.mobile', paths: ['/i/*', '/g/*'] }],
      },
    };
    // Write raw JSON directly — this path must return JSON, not a React screen.
    if (typeof globalThis.document !== 'undefined') {
      globalThis.document.open('application/json');
      globalThis.document.write(JSON.stringify(aasa));
      globalThis.document.close();
    }
    return null;
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
          </WebFrame>
          <Toast config={toastConfig} topOffset={56} />
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
          </WebFrame>
          <Toast config={toastConfig} topOffset={56} />
        </RtlLayoutProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(App);
