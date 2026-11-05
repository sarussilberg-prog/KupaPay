import { Platform } from 'react-native';
import {
    STORE_PRODUCT_PRO_MONTHLY,
    STORE_PRODUCT_PRO_YEARLY,
} from './proConstants';

const ANDROID_PACKAGE =
    process.env.EXPO_PUBLIC_ANDROID_PACKAGE?.trim() || 'com.kupapay.mobile';

const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const IOS_SUBSCRIPTIONS_ITMS = 'itms-apps://apps.apple.com/account/subscriptions';

/** Google Play deep link to a specific subscription SKU for this app. */
export function googlePlaySubscriptionManagementUrl(
    sku: string,
    packageName: string = ANDROID_PACKAGE,
): string {
    const params = new URLSearchParams({ sku, package: packageName });
    return `https://play.google.com/store/account/subscriptions?${params.toString()}`;
}

export function defaultSubscriptionSku(planKind: 'monthly' | 'yearly' | 'unknown'): string {
    if (planKind === 'monthly') return STORE_PRODUCT_PRO_MONTHLY;
    if (planKind === 'yearly') return STORE_PRODUCT_PRO_YEARLY;
    return STORE_PRODUCT_PRO_YEARLY;
}

export function iosSubscriptionManagementUrls(): string[] {
    return Platform.OS === 'ios'
        ? [IOS_SUBSCRIPTIONS_ITMS, IOS_SUBSCRIPTIONS_URL]
        : [IOS_SUBSCRIPTIONS_URL];
}

export const APPLE_REFUND_URL = 'https://reportaproblem.apple.com/';
export const GOOGLE_PLAY_REFUND_URL =
    'https://support.google.com/googleplay/workflow/9813244?hl=en';

export function refundRequestUrl(platformOs: typeof Platform.OS): string | null {
    if (platformOs === 'ios') return APPLE_REFUND_URL;
    if (platformOs === 'android') return GOOGLE_PLAY_REFUND_URL;
    return null;
}
