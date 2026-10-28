import { touchProTrialFeature } from '../../services/proTrialFeatureTouch.service';
import { registerProTrialFeatureUsage } from '../../services/proTrialLifecycle.service';

jest.mock('../../lib/featureFlags', () => ({ KUPAPAY_PRO_ENABLED: true }));
jest.mock('../../services/proTrialLifecycle.service', () => ({
    registerProTrialFeatureUsage: jest.fn().mockResolvedValue(undefined),
}));

describe('touchProTrialFeature', () => {
    it('registers usage when Pro flag is on', () => {
        touchProTrialFeature({ receiptScan: true });
        expect(registerProTrialFeatureUsage).toHaveBeenCalledWith({ receiptScan: true });
    });
});
