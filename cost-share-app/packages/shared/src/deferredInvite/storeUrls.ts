import type { DeferredInvitePayload } from './constants';
import { encodePlayInstallReferrer } from './playInstallReferrer';

export const APP_STORE_LISTING_URL = 'https://apps.apple.com/us/app/kupapay/id6780216665';

export const PLAY_STORE_PACKAGE_ID = 'com.kupapay.mobile';

const PLAY_STORE_LISTING_BASE = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`;

export function playStoreListingUrl(deferredInvite?: DeferredInvitePayload): string {
    if (!deferredInvite) return PLAY_STORE_LISTING_BASE;
    const referrer = encodePlayInstallReferrer(deferredInvite);
    return `${PLAY_STORE_LISTING_BASE}&referrer=${encodeURIComponent(referrer)}`;
}

/** Custom URL scheme contract (see apps/mobile/services/deepLinks.service.ts). */
export function customSchemeInviteUrl(pathKind: 'i' | 'g' | 'sr', token: string): string {
    return `com.kupapay.mobile://invite/${pathKind}/${token}`;
}
