import { useEffect, useState } from 'react';
import {
    getDefaultActivationTemplateFromExperiment,
    getPaywallHeadlineVariant,
} from '../lib/growthExperiments';
import { getProductAnalyticsClient } from '../lib/productAnalytics';
import type { ActivationTemplateId } from '@cost-share/shared';
import type { PaywallHeadlineVariant } from '@cost-share/shared';

/** Subscribes to PostHog feature-flag reloads (#423). Safe no-op when analytics is off. */
export function useGrowthExperimentFlags(): {
    defaultActivationTemplate: ActivationTemplateId;
    paywallHeadlineVariant: PaywallHeadlineVariant;
} {
    const [, bump] = useState(0);

    useEffect(() => {
        const client = getProductAnalyticsClient();
        client?.reloadFeatureFlags?.();
        const unsub = client?.onFeatureFlags?.(() => bump(n => n + 1));
        return () => unsub?.();
    }, []);

    return {
        defaultActivationTemplate: getDefaultActivationTemplateFromExperiment(),
        paywallHeadlineVariant: getPaywallHeadlineVariant(),
    };
}
