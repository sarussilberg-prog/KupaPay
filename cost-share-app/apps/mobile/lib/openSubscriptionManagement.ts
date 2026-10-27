import { Linking, Platform } from 'react-native';
import {
    APP_WEB_ORIGIN,
    buildLegalPageUrl,
    type Language,
    type MySubscriptionSnapshot,
} from '@cost-share/shared';
import { openSubscriptionManagement as openNativeSubscriptionManagement } from '../services/purchases.service';
import {
    defaultSubscriptionSku,
    googlePlaySubscriptionManagementUrl,
    iosSubscriptionManagementUrls,
} from './subscriptionManagementLinks';

const APP_STORE_URL = process.env.EXPO_PUBLIC_APP_STORE_URL;
const PLAY_STORE_URL = process.env.EXPO_PUBLIC_PLAY_STORE_URL;
const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_APP_URL ?? APP_WEB_ORIGIN).replace(/\/$/, '');

export type SubscriptionManagementContext = Pick<
    MySubscriptionSnapshot,
    'store' | 'storeProductId' | 'storePlanId' | 'planKind' | 'lifecycle'
>;

async function openUrlSafe(url: string): Promise<boolean> {
    try {
        await Linking.openURL(url);
        return true;
    } catch {
        return false;
    }
}

/** Opens App Store / Play subscription management, with web and store-URL fallbacks. */
export async function openSubscriptionManagementForUser(
    language: Language,
    ctx?: SubscriptionManagementContext,
): Promise<void> {
    if (Platform.OS === 'web') {
        const url = PLAY_STORE_URL ?? APP_STORE_URL ?? buildLegalPageUrl(WEB_ORIGIN, 'terms', language);
        await Linking.openURL(url);
        return;
    }

    if (Platform.OS === 'android') {
        const sku =
            ctx?.storeProductId ??
            defaultSubscriptionSku(ctx?.planKind === 'monthly' ? 'monthly' : 'yearly');
        if (await openUrlSafe(googlePlaySubscriptionManagementUrl(sku))) return;
    }

    await openNativeSubscriptionManagement();

    if (Platform.OS === 'ios') {
        for (const url of iosSubscriptionManagementUrls()) {
            if (await openUrlSafe(url)) return;
        }
    }

    const fallback = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    if (fallback) await openUrlSafe(fallback);
}

/** Billing grace / payment issue — same store subscription page as manage. */
export async function openFixPaymentForUser(
    language: Language,
    ctx?: SubscriptionManagementContext,
): Promise<void> {
    await openSubscriptionManagementForUser(language, ctx);
}
