import { Platform } from 'react-native';

/** App Store Connect intro offer length (copy + scheduling fallback on iOS). */
export const PRO_TRIAL_LENGTH_DAYS_IOS = 14;

/** Google Play base-plan free-trial offer length (copy + scheduling fallback on Android). */
export const PRO_TRIAL_LENGTH_DAYS_ANDROID = 14;

export function proTrialLengthDays(os: typeof Platform.OS = Platform.OS): number {
    return os === 'android' ? PRO_TRIAL_LENGTH_DAYS_ANDROID : PRO_TRIAL_LENGTH_DAYS_IOS;
}

/** Apple/Google are merchant of record — no in-app EU withdrawal waiver on the paywall. */
export function paywallRequiresEuDigitalWithdrawalAck(_os: typeof Platform.OS = Platform.OS): boolean {
    void _os;
    return false;
}
