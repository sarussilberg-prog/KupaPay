import * as Sentry from '@sentry/react-native';
import type { PaywallPackages } from './purchasesPackage.types';
import type { IntroEligibilityMap } from './proTrialPaywall';
import { captureProductEvent } from './productAnalytics';

export const PAYWALL_OFFERINGS_LOAD_TIMEOUT_MS = 8_000;

export type PaywallLoadFailureReason = 'timeout' | 'empty' | 'error';

export type PaywallLoadResult =
    | {
          status: 'ready';
          packages: PaywallPackages;
          introEligibility: IntroEligibilityMap;
      }
    | {
          status: 'failed';
          reason: PaywallLoadFailureReason;
          detail?: string;
      };

export function isPaywallPackagesEmpty(packages: PaywallPackages | null | undefined): boolean {
    if (!packages) return true;
    return !packages.monthly && !packages.annual && !packages.tripPass;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'timeout'): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(label)), ms);
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

export async function fetchPaywallOfferings(options: {
    loadPackages: () => Promise<PaywallPackages>;
    checkEligibility: (packages: PaywallPackages) => Promise<IntroEligibilityMap>;
    timeoutMs?: number;
}): Promise<PaywallLoadResult> {
    const timeoutMs = options.timeoutMs ?? PAYWALL_OFFERINGS_LOAD_TIMEOUT_MS;
    try {
        const packages = await withTimeout(options.loadPackages(), timeoutMs);
        if (isPaywallPackagesEmpty(packages)) {
            return { status: 'failed', reason: 'empty' };
        }
        const introEligibility = await withTimeout(options.checkEligibility(packages), timeoutMs);
        return { status: 'ready', packages, introEligibility };
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const reason: PaywallLoadFailureReason = detail === 'timeout' ? 'timeout' : 'error';
        return { status: 'failed', reason, detail };
    }
}

export async function reportPaywallLoadFailed(params: {
    featureKey: string;
    groupId?: string;
    reason: PaywallLoadFailureReason;
    detail?: string;
}): Promise<void> {
    const { featureKey, groupId, reason, detail } = params;
    await captureProductEvent('paywall_load_failed', {
        feature_key: featureKey,
        group_id: groupId ?? null,
        reason,
        detail: detail ?? null,
    });
    Sentry.captureMessage('paywall_load_failed', {
        level: 'warning',
        extra: { featureKey, groupId, reason, detail },
    });
}
