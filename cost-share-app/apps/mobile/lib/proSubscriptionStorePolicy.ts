import { Platform } from 'react-native';
import { requiresEuDigitalWithdrawalAck } from './euDigitalPurchaseAck';

/** App Store Connect intro offer length (copy + scheduling fallback on iOS). */
export const PRO_TRIAL_LENGTH_DAYS_IOS = 14;

/** Google Play base-plan free-trial offer length (copy + scheduling fallback on Android). */
export const PRO_TRIAL_LENGTH_DAYS_ANDROID = 14;

export function proTrialLengthDays(os: typeof Platform.OS = Platform.OS): number {
    return os === 'android' ? PRO_TRIAL_LENGTH_DAYS_ANDROID : PRO_TRIAL_LENGTH_DAYS_IOS;
}

/** EU/EEA/UK/CH: in-app acknowledgement before immediate digital delivery (issue #222). */
export function paywallRequiresEuDigitalWithdrawalAck(_os: typeof Platform.OS = Platform.OS): boolean {
    void _os;
    return requiresEuDigitalWithdrawalAck();
}
