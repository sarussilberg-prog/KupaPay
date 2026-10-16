import {
    PRO_TRIAL_LENGTH_DAYS_ANDROID,
    PRO_TRIAL_LENGTH_DAYS_IOS,
    paywallRequiresEuDigitalWithdrawalAck,
    proTrialLengthDays,
} from '../../lib/proSubscriptionStorePolicy';

describe('proSubscriptionStorePolicy', () => {
    it('uses 14-day trial scheduling fallback on iOS and Android', () => {
        expect(proTrialLengthDays('ios')).toBe(PRO_TRIAL_LENGTH_DAYS_IOS);
        expect(PRO_TRIAL_LENGTH_DAYS_IOS).toBe(14);
        expect(proTrialLengthDays('android')).toBe(PRO_TRIAL_LENGTH_DAYS_ANDROID);
        expect(PRO_TRIAL_LENGTH_DAYS_ANDROID).toBe(14);
    });

    it('does not require EU withdrawal ack on the paywall', () => {
        expect(paywallRequiresEuDigitalWithdrawalAck('ios')).toBe(false);
        expect(paywallRequiresEuDigitalWithdrawalAck('android')).toBe(false);
    });
});
