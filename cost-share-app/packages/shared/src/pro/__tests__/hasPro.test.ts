import { hasProFromTimestamps, isProPerkUnlocked, shouldSkipAdGate } from '../hasPro';

describe('hasProFromTimestamps', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');

    it('returns false when both timestamps are absent', () => {
        expect(hasProFromTimestamps({}, now)).toBe(false);
    });

    it('returns true when individual pro is active', () => {
        expect(
            hasProFromTimestamps({ individualProUntil: '2026-12-01T00:00:00.000Z' }, now),
        ).toBe(true);
    });

    it('returns true when group pass is active', () => {
        expect(
            hasProFromTimestamps({ groupPassUntil: '2026-07-01T00:00:00.000Z' }, now),
        ).toBe(true);
    });

    it('returns false when both are expired', () => {
        expect(
            hasProFromTimestamps(
                {
                    individualProUntil: '2026-01-01T00:00:00.000Z',
                    groupPassUntil: '2026-02-01T00:00:00.000Z',
                },
                now,
            ),
        ).toBe(false);
    });
});

describe('shouldSkipAdGate', () => {
    it('requires feature flag and entitlement', () => {
        expect(shouldSkipAdGate(true, false)).toBe(false);
        expect(shouldSkipAdGate(false, true)).toBe(false);
        expect(shouldSkipAdGate(true, true)).toBe(true);
    });
});

describe('isProPerkUnlocked', () => {
    it('unlocks for everyone when Pro flag is off', () => {
        expect(isProPerkUnlocked(false, false)).toBe(true);
        expect(isProPerkUnlocked(true, false)).toBe(true);
    });

    it('requires Pro when flag is on', () => {
        expect(isProPerkUnlocked(false, true)).toBe(false);
        expect(isProPerkUnlocked(true, true)).toBe(true);
    });
});
