import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import type { ProTrialFeatureUsage } from '@cost-share/shared';
import { registerProTrialFeatureUsage } from './proTrialLifecycle.service';

/** Records Pro feature usage during trial for lifecycle messaging (#406). */
export function touchProTrialFeature(usage: ProTrialFeatureUsage): void {
    if (!KUPAPAY_PRO_ENABLED) return;
    void registerProTrialFeatureUsage(usage);
}
