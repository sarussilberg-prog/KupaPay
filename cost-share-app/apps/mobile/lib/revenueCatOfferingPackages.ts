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
    return findPackageByStoreProductId(packages, storeProductId);
}

/** Match entitlement / purchase product ids (incl. Play base-plan suffixes). */
export function findPackageByStoreProductId(
    packages: PurchasesPackageLike[],
    storeProductId: string,
): PurchasesPackageLike | null {
    const exact = packages.find(p => p.product.identifier === storeProductId);
    if (exact) return exact;
    return (
        packages.find(p => {
            const id = p.product.identifier;
            return (
                storeProductId.startsWith(`${id}:`) ||
                storeProductId.startsWith(`${id}-`) ||
                id.startsWith(`${storeProductId}:`)
            );
        }) ?? null
    );
}
