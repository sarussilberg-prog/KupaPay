import type { PurchasesPackageLike } from './purchasesPackage.types';

/** RevenueCat package identifier in the offering (not the Play/App Store product id). */
export function findOfferingPackage(
    packages: PurchasesPackageLike[],
    packageIdentifier: string,
    storeProductId?: string,
): PurchasesPackageLike | null {
    const byPackageId = packages.find(p => p.identifier === packageIdentifier);
    if (byPackageId) return byPackageId;
    if (!storeProductId) return null;
    return packages.find(p => p.product.identifier === storeProductId) ?? null;
}
