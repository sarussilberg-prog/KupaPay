import { Linking, Platform } from 'react-native';

export type IsraeliPaymentApp = 'bit' | 'paybox';

/** Candidate deep links, most specific first. */
const APP_URL_CANDIDATES: Record<IsraeliPaymentApp, readonly string[]> = {
    bit: ['bit://', 'bit://pay'],
    paybox: ['paybox://pay', 'paybox://', 'PayBox://pay', 'PayBox://'],
};

const STORE_URLS: Record<IsraeliPaymentApp, { ios: string; android: string }> = {
    bit: {
        ios: 'https://apps.apple.com/app/id1182007739',
        android: 'https://play.google.com/store/apps/details?id=com.bnhp.payments.paymentsapp',
    },
    paybox: {
        ios: 'https://apps.apple.com/app/id895491053',
        android: 'https://play.google.com/store/apps/details?id=com.payboxapp',
    },
};

const ANDROID_PACKAGES: Record<IsraeliPaymentApp, string> = {
    bit: 'com.bnhp.payments.paymentsapp',
    paybox: 'com.payboxapp',
};

const MOBILE_UA_RE = /iPhone|iPad|iPod|Android/i;

export function isMobileWebUserAgent(): boolean {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
        return false;
    }
    return MOBILE_UA_RE.test(navigator.userAgent);
}

function webMobileStorePlatform(): 'ios' | 'android' | null {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
        return null;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return null;
}

function androidIntentUrl(app: IsraeliPaymentApp): string {
    const scheme = app === 'bit' ? 'bit' : 'paybox';
    const pkg = ANDROID_PACKAGES[app];
    const fallback = encodeURIComponent(STORE_URLS[app].android);
    return `intent://pay#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${fallback};end`;
}

export function isIsraeliPaymentAppAvailable(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android' || isMobileWebUserAgent();
}

async function tryOpenUrl(url: string): Promise<boolean> {
    try {
        await Linking.openURL(url);
        return true;
    } catch {
        return false;
    }
}

async function openStoreListing(app: IsraeliPaymentApp): Promise<void> {
    const storeUrl = Platform.select({
        ios: STORE_URLS[app].ios,
        android: STORE_URLS[app].android,
        default: STORE_URLS[app].ios,
    });
    if (!storeUrl) throw new Error('unsupported_platform');
    await Linking.openURL(storeUrl);
}

async function openPaymentAppOnMobileWeb(app: IsraeliPaymentApp): Promise<void> {
    const storePlatform = webMobileStorePlatform();
    if (!storePlatform) {
        throw new Error('unsupported_platform');
    }

    for (const url of APP_URL_CANDIDATES[app]) {
        if (await tryOpenUrl(url)) return;
    }

    if (storePlatform === 'android') {
        if (await tryOpenUrl(androidIntentUrl(app))) return;
    }

    await Linking.openURL(STORE_URLS[app][storePlatform]);
}

export async function openPaymentApp(app: IsraeliPaymentApp): Promise<void> {
    if (Platform.OS === 'web') {
        await openPaymentAppOnMobileWeb(app);
        return;
    }

    for (const url of APP_URL_CANDIDATES[app]) {
        if (Platform.OS === 'ios') {
            try {
                const supported = await Linking.canOpenURL(url);
                if (supported && (await tryOpenUrl(url))) return;
            } catch {
                // Scheme not declared in LSApplicationQueriesSchemes — try direct open below.
            }
        }
        if (await tryOpenUrl(url)) return;
    }

    await openStoreListing(app);
}
