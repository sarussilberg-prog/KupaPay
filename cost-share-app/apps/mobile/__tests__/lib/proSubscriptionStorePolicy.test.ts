import {
    PRO_TRIAL_LENGTH_DAYS_ANDROID,
    PRO_TRIAL_LENGTH_DAYS_IOS,
    paywallRequiresEuDigitalWithdrawalAck,
    proTrialLengthDays,
} from '../../lib/proSubscriptionStorePolicy';
import * as euDigitalPurchaseAck from '../../lib/euDigitalPurchaseAck';

describe('proSubscriptionStorePolicy', () => {
    it('uses 14-day trial scheduling fallback on iOS and Android', () => {
        expect(proTrialLengthDays('ios')).toBe(PRO_TRIAL_LENGTH_DAYS_IOS);
        expect(PRO_TRIAL_LENGTH_DAYS_IOS).toBe(14);
        expect(proTrialLengthDays('android')).toBe(PRO_TRIAL_LENGTH_DAYS_ANDROID);
        expect(PRO_TRIAL_LENGTH_DAYS_ANDROID).toBe(14);
    });

    it('follows device region for EU withdrawal ack on the paywall', () => {
        const spy = jest.spyOn(euDigitalPurchaseAck, 'requiresEuDigitalWithdrawalAck');
        spy.mockReturnValue(false);
        expect(paywallRequiresEuDigitalWithdrawalAck('ios')).toBe(false);
        spy.mockReturnValue(true);
        expect(paywallRequiresEuDigitalWithdrawalAck('android')).toBe(true);
        spy.mockRestore();
    });
});
