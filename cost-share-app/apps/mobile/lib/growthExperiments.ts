import {
    GROWTH_EXPERIMENT_FLAG_KEYS,
    resolveOnboardingTemplateDefault,
    resolvePaywallHeadlineVariant,
    type OnboardingTemplateExperimentVariant,
    type PaywallHeadlineVariant,
} from '@cost-share/shared';
import { getProductAnalyticsClient } from './productAnalytics';

function readFlag(key: string): string | boolean | undefined {
    const client = getProductAnalyticsClient();
    if (!client?.getFeatureFlag) return undefined;
    try {
        return client.getFeatureFlag(key);
    } catch {
        return undefined;
    }
}

export function getOnboardingTemplateExperimentVariant(): OnboardingTemplateExperimentVariant {
    const raw = readFlag(GROWTH_EXPERIMENT_FLAG_KEYS.onboardingTemplateDefault);
    return resolveOnboardingTemplateDefault(raw) === 'roommates' ? 'roommates_first' : 'control';
}

export function getDefaultActivationTemplateFromExperiment(): ReturnType<
    typeof resolveOnboardingTemplateDefault
> {
    return resolveOnboardingTemplateDefault(
        readFlag(GROWTH_EXPERIMENT_FLAG_KEYS.onboardingTemplateDefault),
    );
}

export function getPaywallHeadlineVariant(): PaywallHeadlineVariant {
    return resolvePaywallHeadlineVariant(readFlag(GROWTH_EXPERIMENT_FLAG_KEYS.paywallHeadline));
}
