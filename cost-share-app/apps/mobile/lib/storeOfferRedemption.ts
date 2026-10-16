import { Platform } from 'react-native';

/** Google Play promo / offer code redemption (opens Play redeem UI). */
export const GOOGLE_PLAY_OFFER_REDEEM_URL = 'https://play.google.com/redeem';

export function offerRedemptionTarget(): 'ios_sheet' | 'android_play_redeem' | null {
    if (Platform.OS === 'ios') return 'ios_sheet';
    if (Platform.OS === 'android') return 'android_play_redeem';
    return null;
}

export function googlePlayOfferRedeemUrl(): string {
    return GOOGLE_PLAY_OFFER_REDEEM_URL;
}
