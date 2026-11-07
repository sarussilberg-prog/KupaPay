import {
    type RestorePurchasesResult,
    restorePurchasesToastTitleKey,
} from '@cost-share/shared';
import { showAppToast } from './appToast';

export function showRestorePurchasesToast(result: RestorePurchasesResult): void {
    if (result.status === 'error') {
        const message = result.message?.trim();
        showAppToast({
            type: 'error',
            title: message || undefined,
            titleKey: message ? undefined : 'pro.paywall.restoreError',
        });
        return;
    }

    const titleKey = restorePurchasesToastTitleKey(result);
    if (!titleKey) return;

    showAppToast({
        type: result.status === 'none' ? 'info' : 'success',
        titleKey,
    });
}

export function shouldRefetchAfterRestore(result: RestorePurchasesResult): boolean {
    return result.status === 'pro_active' || result.status === 'pro_restored';
}
