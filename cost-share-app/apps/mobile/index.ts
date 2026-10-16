import { ensureWebCryptoPolyfill } from './lib/polyfillWebCrypto';

ensureWebCryptoPolyfill();

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

function isStoreCaptureEntry(): boolean {
    if (process.env.EXPO_PUBLIC_ASC_SCREENSHOT_DEMO === 'true') return true;
    if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined') {
        const params = new URLSearchParams(globalThis.location.search);
        return params.get('capture') === '1' || params.has('screen');
    }
    return false;
}

if (isStoreCaptureEntry()) {
    process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://drxfbicunusmipdgbgdk.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??=
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyeGZiaWN1bnVzbWlwZGdiZ2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDB9.capture-screenshot-anon-key';
    // Avoid loading App.tsx (Supabase auth boot) for Playwright store captures.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    registerRootComponent(require('./screenshotDemo/AscStoreListingCaptureApp').default);
} else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    registerRootComponent(require('./App').default);
}
