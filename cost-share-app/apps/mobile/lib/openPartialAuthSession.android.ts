/**
 * Android OAuth in a partial-height Chrome Custom Tab (bottom sheet).
 * Google account UI renders inside Chrome — not a WebView (allowed by Google policy).
 */
import { AppState, Dimensions, Linking, type AppStateStatus } from 'react-native';
import { openPartialCustomTabAsync } from 'kupa-partial-auth-browser';

export type PartialAuthSessionResult =
  | { type: 'success'; url: string }
  | { type: 'cancel' }
  | { type: 'dismiss' };

const SHEET_HEIGHT_RATIO = 0.8;

let redirectSubscription: { remove: () => void } | null = null;
let onBrowserClose: (() => void) | null = null;
let isAppStateAvailable = AppState.currentState !== null;

function onAppStateChange(state: AppStateStatus) {
  if (!isAppStateAvailable) {
    isAppStateAvailable = true;
    return;
  }
  if (state === 'active' && onBrowserClose) {
    onBrowserClose();
  }
}

async function waitForBrowserDismiss(): Promise<PartialAuthSessionResult> {
  return new Promise((resolve) => {
    onBrowserClose = () => resolve({ type: 'dismiss' });
  });
}

function waitForRedirect(returnUrl: string): Promise<PartialAuthSessionResult> {
  return new Promise((resolve) => {
    const handler = ({ url }: { url: string }) => {
      if (url.startsWith(returnUrl)) {
        resolve({ type: 'success', url });
      }
    };
    redirectSubscription = Linking.addEventListener('url', handler);
  });
}

function stopWaitingForRedirect() {
  redirectSubscription?.remove();
  redirectSubscription = null;
}

export async function openPartialAuthSessionAsync(
  startUrl: string,
  returnUrl: string,
): Promise<PartialAuthSessionResult> {
  if (redirectSubscription || onBrowserClose) {
    throw new Error('An auth session is already in progress');
  }

  const heightPx = Math.round(Dimensions.get('window').height * SHEET_HEIGHT_RATIO);
  const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

  try {
    const opened = await openPartialCustomTabAsync(startUrl, heightPx);
    if (opened.type !== 'opened') {
      return { type: 'cancel' };
    }

    return await Promise.race([
      waitForRedirect(returnUrl),
      waitForBrowserDismiss(),
    ]);
  } finally {
    appStateSubscription.remove();
    stopWaitingForRedirect();
    onBrowserClose = null;
  }
}
