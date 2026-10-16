import { Platform } from 'react-native';

function captureFromUrl(): boolean {
  if (Platform.OS !== 'web' || typeof globalThis.location === 'undefined') return false;
  const params = new URLSearchParams(globalThis.location.search);
  return params.get('capture') === '1' || params.has('screen');
}

/** CI / Playwright store screenshot mode — skips auth and Supabase boot. */
export function isAscScreenshotDemo(): boolean {
  return process.env.EXPO_PUBLIC_ASC_SCREENSHOT_DEMO === 'true' || captureFromUrl();
}

export function ascScreenshotLocale(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_SCREENSHOT_LOCALE?.trim();
  return raw || undefined;
}
