/** RevenueCat restorePurchases outcome mapping for localized UI toasts. */

export type RestorePurchasesResult =
    | { status: 'pro_active' }
    | { status: 'pro_restored' }
    | { status: 'none' }
    | { status: 'error'; message?: string };

export function interpretRestorePurchases(input: {
    hadProBeforeRestore: boolean;
    proActiveAfterRestore: boolean;
    errorMessage?: string;
}): RestorePurchasesResult {
    if (input.errorMessage) {
        return { status: 'error', message: input.errorMessage };
    }
    if (!input.proActiveAfterRestore) {
        return { status: 'none' };
    }
    if (input.hadProBeforeRestore) {
        return { status: 'pro_active' };
    }
    return { status: 'pro_restored' };
}

export function restorePurchasesToastTitleKey(
    result: RestorePurchasesResult,
): string | undefined {
    switch (result.status) {
        case 'pro_active':
            return 'pro.paywall.restoreProActive';
        case 'pro_restored':
            return 'pro.paywall.restoreProRestored';
        case 'none':
            return 'pro.paywall.restoreNone';
        case 'error':
            return undefined;
        default:
            return undefined;
    }
}
