import {
    paywallTitleKeyForVariant,
    resolveOnboardingTemplateDefault,
    resolvePaywallHeadlineVariant,
} from '../growthExperiments';

describe('growthExperiments', () => {
    it('resolveOnboardingTemplateDefault maps roommates variant', () => {
        expect(resolveOnboardingTemplateDefault('roommates_first')).toBe('roommates');
        expect(resolveOnboardingTemplateDefault('control')).toBe('trip');
        expect(resolveOnboardingTemplateDefault(undefined)).toBe('trip');
    });

    it('resolvePaywallHeadlineVariant maps value_focus', () => {
        expect(resolvePaywallHeadlineVariant('value_focus')).toBe('value_focus');
        expect(resolvePaywallHeadlineVariant(true)).toBe('value_focus');
        expect(resolvePaywallHeadlineVariant('control')).toBe('control');
    });

    it('paywallTitleKeyForVariant returns i18n keys', () => {
        expect(paywallTitleKeyForVariant('control')).toBe('pro.paywall.title');
        expect(paywallTitleKeyForVariant('value_focus')).toBe('pro.paywall.titleValueFocus');
    });
});
