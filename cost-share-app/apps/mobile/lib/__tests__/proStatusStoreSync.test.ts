import {
    mergeProStatusWithStoreEntitlement,
    readActiveProExpirationFromStore,
} from '../proStatusStoreSync';
import type { MyProStatus } from '../../services/proEntitlements.service';

const baseStatus = (): MyProStatus => ({
    hasPro: false,
    individualProUntil: null,
    groupPassUntil: null,
    includedTripPassCredits: 0,
    unassignedTripPassCount: 0,
    adminProViewMode: 'real',
    adminProViewExpiresAt: null,
});

describe('readActiveProExpirationFromStore', () => {
    it('returns undefined when customer info is missing', () => {
        expect(readActiveProExpirationFromStore(null)).toBeUndefined();
    });

    it('reads expiration from active pro entitlement', () => {
        const iso = new Date(Date.now() + 86400000).toISOString();
        expect(
            readActiveProExpirationFromStore({
                entitlements: { active: { pro: { expirationDate: iso } } },
            }),
        ).toBe(iso);
    });
});

describe('mergeProStatusWithStoreEntitlement', () => {
    it('leaves status unchanged when store has no active entitlement', () => {
        const status = baseStatus();
        expect(mergeProStatusWithStoreEntitlement(status, undefined)).toBe(status);
    });

    it('sets hasPro when store reports active pro before webhook', () => {
        const until = new Date(Date.now() + 30 * 86400000).toISOString();
        const merged = mergeProStatusWithStoreEntitlement(baseStatus(), until);
        expect(merged.hasPro).toBe(true);
        expect(merged.individualProUntil).toBe(until);
    });

    it('ignores expired store entitlement', () => {
        const expired = new Date(Date.now() - 86400000).toISOString();
        const merged = mergeProStatusWithStoreEntitlement(baseStatus(), expired);
        expect(merged.hasPro).toBe(false);
    });
});
