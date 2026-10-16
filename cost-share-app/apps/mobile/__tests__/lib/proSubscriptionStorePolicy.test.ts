import {
    PRO_TRIAL_LENGTH_DAYS_ANDROID,
    PRO_TRIAL_LENGTH_DAYS_IOS,
    paywallRequiresEuDigitalWithdrawalAck,
    proTrialLengthDays,
} from '../../lib/proSubscriptionStorePolicy';

describe('proSubscriptionStorePolicy', () => {
    it('uses 7-day trial copy fallback on iOS and 14-day on Android', () => {
        expect(proTrialLengthDays('ios')).toBe(PRO_TRIAL_LENGTH_DAYS_IOS);
        expect(PRO_TRIAL_LENGTH_DAYS_IOS).toBe(7);
        expect(proTrialLengthDays('android')).toBe(PRO_TRIAL_LENGTH_DAYS_ANDROID);
        expect(PRO_TRIAL_LENGTH_DAYS_ANDROID).toBe(14);
    });

    it('requires EU withdrawal ack on iOS paywall only', () => {
        expect(paywallRequiresEuDigitalWithdrawalAck('ios')).toBe(true);
        expect(paywallRequiresEuDigitalWithdrawalAck('android')).toBe(false);
    });
});
