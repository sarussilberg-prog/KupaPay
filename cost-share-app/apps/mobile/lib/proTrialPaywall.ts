import type { PaywallPackages, PurchasesPackageLike } from './purchasesPackage.types';
import {
    STORE_PRODUCT_PRO_MONTHLY,
    STORE_PRODUCT_PRO_YEARLY,
} from './proConstants';

/** Mirrors RevenueCat INTRO_ELIGIBILITY_STATUS.ELIGIBLE */
export const INTRO_ELIGIBILITY_ELIGIBLE = 2;

export type IntroEligibilityEntry = { status: number };

export type IntroEligibilityMap = Record<string, IntroEligibilityEntry | undefined>;

export function packageHasIntroFreeTrial(pkg: PurchasesPackageLike | null): boolean {
    if (!pkg?.product.introPrice) return false;
    return pkg.product.introPrice.price === 0;
}

export function isProductIntroEligible(
    map: IntroEligibilityMap | null | undefined,
    productId: string,
): boolean {
    if (!map) return false;
    return map[productId]?.status === INTRO_ELIGIBILITY_ELIGIBLE;
}

export function collectSubscriptionProductIds(packages: PaywallPackages | null): string[] {
    const ids: string[] = [];
    const monthly = packages?.monthly?.product.identifier;
    const yearly = packages?.annual?.product.identifier;
    if (monthly) ids.push(monthly);
    if (yearly) ids.push(yearly);
    if (!ids.length) {
        ids.push(STORE_PRODUCT_PRO_MONTHLY, STORE_PRODUCT_PRO_YEARLY);
    }
    return [...new Set(ids)];
}

export function planShowsFreeTrial(
    plan: 'monthly' | 'yearly',
    packages: PaywallPackages | null,
    eligibility: IntroEligibilityMap | null,
): boolean {
    const pkg = plan === 'monthly' ? packages?.monthly : packages?.annual;
    if (!pkg || !packageHasIntroFreeTrial(pkg)) return false;
    return isProductIntroEligible(eligibility, pkg.product.identifier);
}
