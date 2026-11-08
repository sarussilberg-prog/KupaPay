import {
    buildSubscriptionSnapshot,
    type EntitlementWireSlice,
    type MySubscriptionSnapshot,
    type TripPassLine,
} from '@cost-share/shared';
import type { GroupWithMembers } from '@cost-share/shared';
import { usesStaticFixtureData } from '../lib/staticFixtureMode';
import { STORE_PRODUCT_PRO_YEARLY } from '../lib/proConstants';
import { fetchMyProStatus } from './proEntitlements.service';
import {
    isPurchasesConfigured,
    fetchLocalizedProductPriceString,
    fetchPurchasesCustomerInfo,
    waitForPurchasesReady,
} from './purchases.service';

function toIsoString(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
}

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
    const unsubscribeDetectedAt = toIsoString(
        ent.unsubscribeDetectedAt as string | Date | null | undefined,
    );
    return {
        isActive: ent.isActive === true,
        willRenew: unsubscribeDetectedAt ? false : ent.willRenew === true,
        expirationDate: toIsoString(ent.expirationDate as string | Date | null | undefined),
        productIdentifier: String(ent.productIdentifier ?? ''),
        productPlanIdentifier: (ent.productPlanIdentifier as string | null) ?? null,
        store: (ent.store as string | null) ?? null,
        periodType: (ent.periodType as string | null) ?? null,
        unsubscribeDetectedAt,
        billingIssueDetectedAt: toIsoString(
            ent.billingIssueDetectedAt as string | Date | null | undefined,
        ),
    };
}

async function priceForProduct(
    productId: string,
    productPlanIdentifier: string | null | undefined,
): Promise<string | null> {
    return fetchLocalizedProductPriceString(productId, productPlanIdentifier);
}

async function loadTripPassLines(groups: GroupWithMembers[]): Promise<TripPassLine[]> {
    const lines: TripPassLine[] = [];
    const now = Date.now();
    for (const group of groups.slice(0, 12)) {
        const status = await fetchMyProStatus(group.id);
        const until = status.groupPassUntil;
        if (!until || new Date(until).getTime() <= now) continue;
        const expiresAt = toIsoString(until);
        if (!expiresAt) continue;
        lines.push({ groupId: group.id, groupName: group.name, expiresAt });
    }
    return lines;
}

export async function fetchMySubscriptionSnapshot(
    groups: GroupWithMembers[],
): Promise<MySubscriptionSnapshot | null> {
    if (usesStaticFixtureData()) return CAPTURE_SNAPSHOT;

    const serverStatus = await fetchMyProStatus();
    const tripPasses = await loadTripPassLines(groups);

    if (!isPurchasesConfigured()) {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: toIsoString(serverStatus.individualProUntil),
            tripPasses,
        });
    }

    const ready = await waitForPurchasesReady();
    if (!ready) {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: toIsoString(serverStatus.individualProUntil),
            tripPasses,
        });
    }

    try {
        const info = await fetchPurchasesCustomerInfo();
        if (!info) {
            if (!serverStatus.hasPro && tripPasses.length === 0) return null;
            return buildSubscriptionSnapshot({
                entitlement: null,
                priceString: null,
                serverIndividualUntil: toIsoString(serverStatus.individualProUntil),
                tripPasses,
            });
        }
        const entRaw = info.entitlements.active.pro ?? info.entitlements.all.pro;
        const ent = entitlementFromRc(entRaw as unknown as Record<string, unknown> | undefined);
        const priceString = ent?.productIdentifier
            ? await priceForProduct(ent.productIdentifier, ent.productPlanIdentifier)
            : null;

        const snap = buildSubscriptionSnapshot({
            entitlement: ent,
            priceString,
            serverIndividualUntil: toIsoString(serverStatus.individualProUntil),
            tripPasses,
        });

        if (snap.lifecycle === 'none' && tripPasses.length === 0) return null;
        return snap;
    } catch {
        if (!serverStatus.hasPro && tripPasses.length === 0) return null;
        return buildSubscriptionSnapshot({
            entitlement: null,
            priceString: null,
            serverIndividualUntil: toIsoString(serverStatus.individualProUntil),
            tripPasses,
        });
    }
}
