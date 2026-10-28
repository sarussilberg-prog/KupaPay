import type { MyProStatus } from '../services/proEntitlements.service';
import { REVENUECAT_ENTITLEMENT_PRO } from './proConstants';

/** Minimal CustomerInfo slice — avoids importing react-native-purchases in unit tests. */
export type StoreCustomerInfoSlice = {
    entitlements: {
        active: Record<
            string,
            { expirationDate?: string | Date | null; isActive?: boolean } | undefined
        >;
    };
};

function expirationToIso(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
}

/**
 * Returns expiration ISO when the store reports an active Pro entitlement;
 * `undefined` when there is no active entitlement (caller should not merge).
 */
export function readActiveProExpirationFromStore(
    info: StoreCustomerInfoSlice | null | undefined,
    entitlementId: string = REVENUECAT_ENTITLEMENT_PRO,
): string | null | undefined {
    if (!info) return undefined;
    const ent = info.entitlements.active[entitlementId];
    if (!ent || ent.isActive === false) return undefined;
    return expirationToIso(ent.expirationDate);
}

function isFutureIso(iso: string | null): boolean {
    if (!iso) return true;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) && ms > Date.now();
}

function toIsoOrNull(value: string | Date | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
}

function laterIso(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * When RevenueCat reports Pro before the Supabase webhook updates `get_my_pro_status`,
 * keep the client entitled so Settings upsells hide immediately after purchase/restore.
 */
export function mergeProStatusWithStoreEntitlement(
    status: MyProStatus,
    storeExpirationIso: string | null | undefined,
): MyProStatus {
    if (storeExpirationIso === undefined) {
        return status;
    }
    if (storeExpirationIso != null && !isFutureIso(storeExpirationIso)) {
        return status;
    }
    const storeUntil = storeExpirationIso ?? null;
    return {
        ...status,
        hasPro: true,
        individualProUntil: laterIso(toIsoOrNull(status.individualProUntil), storeUntil),
    };
}
