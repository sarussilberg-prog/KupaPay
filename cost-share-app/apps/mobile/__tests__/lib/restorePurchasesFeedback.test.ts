import { showRestorePurchasesToast } from '../../lib/restorePurchasesFeedback';
import { showAppToast } from '../../lib/appToast';

jest.mock('../../lib/appToast', () => ({
    showAppToast: jest.fn(),
}));

const showAppToastMock = showAppToast as jest.MockedFunction<typeof showAppToast>;

describe('showRestorePurchasesToast', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows success when Pro was restored', () => {
        showRestorePurchasesToast({ status: 'pro_restored' });
        expect(showAppToastMock).toHaveBeenCalledWith({
            type: 'success',
            titleKey: 'pro.paywall.restoreProRestored',
        });
    });

    it('shows info when nothing to restore', () => {
        showRestorePurchasesToast({ status: 'none' });
        expect(showAppToastMock).toHaveBeenCalledWith({
            type: 'info',
            titleKey: 'pro.paywall.restoreNone',
        });
    });

    it('shows error message from RevenueCat', () => {
        showRestorePurchasesToast({ status: 'error', message: 'Billing unavailable' });
        expect(showAppToastMock).toHaveBeenCalledWith({
            type: 'error',
            title: 'Billing unavailable',
        });
    });
});
