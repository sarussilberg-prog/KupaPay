import {
    interpretRestorePurchases,
    restorePurchasesToastTitleKey,
} from '../restorePurchasesResult';

describe('interpretRestorePurchases', () => {
    it('returns error when errorMessage is set', () => {
        expect(
            interpretRestorePurchases({
                hadProBeforeRestore: false,
                proActiveAfterRestore: false,
                errorMessage: 'network',
            }),
        ).toEqual({ status: 'error', message: 'network' });
    });

    it('returns none when Pro is not active after restore', () => {
        expect(
            interpretRestorePurchases({
                hadProBeforeRestore: true,
                proActiveAfterRestore: false,
            }),
        ).toEqual({ status: 'none' });
    });

    it('returns pro_active when Pro was already active before restore', () => {
        expect(
            interpretRestorePurchases({
                hadProBeforeRestore: true,
                proActiveAfterRestore: true,
            }),
        ).toEqual({ status: 'pro_active' });
    });

    it('returns pro_restored when Pro becomes active after restore', () => {
        expect(
            interpretRestorePurchases({
                hadProBeforeRestore: false,
                proActiveAfterRestore: true,
            }),
        ).toEqual({ status: 'pro_restored' });
    });
});

describe('restorePurchasesToastTitleKey', () => {
    it('maps outcomes to paywall toast keys', () => {
        expect(restorePurchasesToastTitleKey({ status: 'pro_active' })).toBe(
            'pro.paywall.restoreProActive',
        );
        expect(restorePurchasesToastTitleKey({ status: 'pro_restored' })).toBe(
            'pro.paywall.restoreProRestored',
        );
        expect(restorePurchasesToastTitleKey({ status: 'none' })).toBe('pro.paywall.restoreNone');
        expect(restorePurchasesToastTitleKey({ status: 'error', message: 'x' })).toBeUndefined();
    });
});
