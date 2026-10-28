import { GROWTH_EXPERIMENT_FLAG_KEYS } from '@cost-share/shared';
import { setProductAnalyticsClient } from '../../lib/productAnalytics';
import {
    getDefaultActivationTemplateFromExperiment,
    getPaywallHeadlineVariant,
} from '../../lib/growthExperiments';

describe('growthExperiments', () => {
    afterEach(() => {
        setProductAnalyticsClient(null);
    });

    it('defaults when PostHog client is missing', () => {
        expect(getDefaultActivationTemplateFromExperiment()).toBe('trip');
        expect(getPaywallHeadlineVariant()).toBe('control');
    });

    it('reads PostHog multivariate flags', () => {
        setProductAnalyticsClient({
            capture: jest.fn(),
            identify: jest.fn(),
            reset: jest.fn(),
            getFeatureFlag: (key: string) => {
                if (key === GROWTH_EXPERIMENT_FLAG_KEYS.onboardingTemplateDefault) {
                    return 'roommates_first';
                }
                if (key === GROWTH_EXPERIMENT_FLAG_KEYS.paywallHeadline) {
                    return 'value_focus';
                }
                return undefined;
            },
        });
        expect(getDefaultActivationTemplateFromExperiment()).toBe('roommates');
        expect(getPaywallHeadlineVariant()).toBe('value_focus');
    });
});
