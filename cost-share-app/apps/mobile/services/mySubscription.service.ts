import {
    buildSubscriptionSnapshot,
    type EntitlementWireSlice,
    type MySubscriptionSnapshot,
    type TripPassLine,
} from '@cost-share/shared';
import type { GroupWithMembers } from '@cost-share/shared';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';
import { paywallDisplayPrice } from '../lib/paywallDisplayPrice';
import {
    STORE_PRODUCT_PRO_MONTHLY,
    STORE_PRODUCT_PRO_YEARLY,
} from '../lib/proConstants';
import { fetchMyProStatus } from './proEntitlements.service';
import {
    isPurchasesConfigured,
    loadOfferingPackages,
    waitForPurchasesReady,
} from './purchases.service';

const CAPTURE_SNAPSHOT: MySubscriptionSnapshot = {
    lifecycle: 'active',
    planKind: 'yearly',
    priceString: '₪69.90',
    renewalOrExpiryIso: '2027-01-15T00:00:00.000Z',
    autoRenew: true,
    store: 'app_store',
    storeProductId: STORE_PRODUCT_PRO_YEARLY,
    storePlanId: null,
    isFreeTrial: false,
    tripPasses: [
        {
            groupId: 'g-barcelona',
            groupName: 'Barcelona Trip',
            expiresAt: '2026-12-20T00:00:00.000Z',
        },
    ],
    serverIndividualUntil: '2027-01-15T00:00:00.000Z',
};

function entitlementFromRc(ent: Record<string, unknown> | undefined): EntitlementWireSlice | null {
    if (!ent) return null;
    return {
        isActive: ent.isActive === true,
        willRenew: ent.willRenew !== false,
        expirationDate: (ent.expirationDate as string | null) ?? null,
        productIdentifier: String(ent.productIdentifier ?? ''),
        productPlanIdentifier: (ent.productPlanIdentifier as string | null) ?? null,
        store: (ent.store as string | null) ?? null,
        periodType: (ent.periodType as string | null) ?? null,
        unsubscribeDetectedAt: (ent.unsubscribeDetectedAt as string | null) ?? null,
        billingIssueDetectedAt: (ent.billingIssueDetectedAt as string | null) ?? null,
    };
}

async function priceForProduct(
    productId: string,
    packages: Awaited<ReturnType<typeof loadOfferingPackages>>,
): Promise<string | null> {
    if (productId === STORE_PRODUCT_PRO_MONTHLY && packages.monthly) {
        return paywallDisplayPrice(packages.monthly, 'monthly');
    }
    if (productId === STORE_PRODUCT_PRO_YEARLY && packages.annual) {
        return paywallDisplayPrice(packages.annual, 'yearly');
    }
    return null;
}

async function loadTripPassLines(groups: GroupWithMembers[]): Promise<TripPassLine[]> {
    const lines: TripPassLine[] = [];
    const now = Date.now();
    for (const group of groups.slice(0, 12)) {
        const status = await fetchMyProStatus(group.id);
        const until = status.groupPassUntil;
        if (!until || new Date(until).getTime() <= now) continue;
        lines.push({ groupId: group.id, groupName: group.name, expiresAt: until });
    }
    return lines;
}

export async function fetchMySubscriptionSnapshot(
    groups: GroupWithMembers[],
): Promise<MySubscriptionSnapshot | null> {
    if (isAscScreenshotDemo()) return CAPTURE_SNAPSHOT;

    const serverStatus = await fetchMyProStatus();
    const tripPasses = await loadTripPassLines(groups);

    if (!isPurchasesConfigured()) {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: serverStatus.individualProUntil ?? null,
            tripPasses,
        });
    }

    const ready = await waitForPurchasesReady();
    if (!ready) {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: serverStatus.individualProUntil ?? null,
            tripPasses,
        });
    }

    try {
        const Purchases = await import('react-native-purchases');
        const [info, packages] = await Promise.all([
            Purchases.default.getCustomerInfo(),
            loadOfferingPackages(),
        ]);
        const entRaw = info.entitlements.active.pro ?? info.entitlements.all.pro;
        const ent = entitlementFromRc(entRaw as Record<string, unknown> | undefined);
        const priceString = ent?.productIdentifier
            ? await priceForProduct(ent.productIdentifier, packages)
            : null;

        const snap = buildSubscriptionSnapshot({
            entitlement: ent,
            priceString,
            serverIndividualUntil: serverStatus.individualProUntil ?? null,
            tripPasses,
        });

        if (snap.lifecycle === 'none' && tripPasses.length === 0) return null;
        return snap;
    } catch {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: serverStatus.individualProUntil ?? null,
            tripPasses,
        });
    }
}
