import { Platform } from 'react-native';

/** App Store Connect intro offer length (copy + scheduling fallback on iOS). */
export const PRO_TRIAL_LENGTH_DAYS_IOS = 7;

/** Google Play base-plan free-trial offer length (copy + scheduling fallback on Android). */
export const PRO_TRIAL_LENGTH_DAYS_ANDROID = 14;

export function proTrialLengthDays(os: typeof Platform.OS = Platform.OS): number {
    return os === 'android' ? PRO_TRIAL_LENGTH_DAYS_ANDROID : PRO_TRIAL_LENGTH_DAYS_IOS;
}

/** EU withdrawal checkbox — App Store paywall only; Play Billing uses Google's purchase flow. */
export function paywallRequiresEuDigitalWithdrawalAck(os: typeof Platform.OS = Platform.OS): boolean {
    return os === 'ios';
}
