import type { ActivationTemplateId } from '../activation/templates';

/** PostHog feature flag keys (#423). Create matching flags in PostHog (multivariate or boolean). */
export const GROWTH_EXPERIMENT_FLAG_KEYS = {
    onboardingTemplateDefault: 'exp-onboarding-template-default',
    paywallHeadline: 'exp-paywall-headline',
} as const;

export type PaywallHeadlineVariant = 'control' | 'value_focus';

export type OnboardingTemplateExperimentVariant = 'control' | 'roommates_first';

export function resolveOnboardingTemplateDefault(
    flagValue: string | boolean | undefined | null,
): ActivationTemplateId {
    if (flagValue === 'roommates_first' || flagValue === 'roommates') {
        return 'roommates';
    }
    return 'trip';
}

export function resolvePaywallHeadlineVariant(
    flagValue: string | boolean | undefined | null,
): PaywallHeadlineVariant {
    if (flagValue === 'value_focus' || flagValue === true) {
        return 'value_focus';
    }
    return 'control';
}

export function paywallTitleKeyForVariant(variant: PaywallHeadlineVariant): string {
    return variant === 'value_focus' ? 'pro.paywall.titleValueFocus' : 'pro.paywall.title';
}
