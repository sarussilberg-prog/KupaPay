import * as fc from 'fast-check';
import {
    deriveSimplifiedDebts,
    SimplifiedInputsPayload,
    SimplifiedInputsGroup,
} from '@cost-share/shared';

const CURRENCIES = ['USD', 'EUR', 'ILS', 'IRR'];

/** Generate a balanced (group, currency): last user absorbs rounding so Σ = 0 cents. */
function arbCurrency(memberIds: string[]) {
    return fc
        .tuple(
            fc.constantFrom(...CURRENCIES),
            fc.array(fc.integer({ min: -10000, max: 10000 }), {
                minLength: memberIds.length,
                maxLength: memberIds.length,
            }),
        )
        .map(([currency, cents]) => {
            const total = cents.reduce((a: number, b: number) => a + b, 0);
            const adjusted = [...cents];
            adjusted[adjusted.length - 1] -= total;
            return {
                currency,
                nets: memberIds.map((userId, i) => ({
                    userId,
                    net: adjusted[i] / 100,
                })),
            };
        });
}

function dedupeCurrencies<T extends { currency: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    return arr.filter(c => {
        if (seen.has(c.currency)) return false;
        seen.add(c.currency);
        return true;
    });
}

function arbGroup(
    groupId: string,
    memberIds: string[],
): fc.Arbitrary<SimplifiedInputsGroup> {
    return fc
        .array(arbCurrency(memberIds), { minLength: 0, maxLength: 3 })
        .map(currencies => ({
            groupId,
            members: memberIds.map(userId => ({
                userId,
                name: userId,
                avatarUrl: null,
            })),
            currencies: dedupeCurrencies(currencies),
        }));
}

const arbPayload: fc.Arbitrary<SimplifiedInputsPayload> = fc
    .tuple(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 2, max: 5 }),
    )
    .chain(([groupCount, memberCount]) => {
        const memberIds = Array.from({ length: memberCount }, (_, i) => `u_${i}`);
        const groupIds = Array.from({ length: groupCount }, (_, i) => `g_${i}`);
        return fc
            .tuple(...groupIds.map(gid => arbGroup(gid, memberIds)))
            .map(groups => ({ groups }));
    });

function round2(n: number): number {
    return Number(n.toFixed(2));
}

describe('deriveSimplifiedDebts — invariants', () => {
    it('inv 1: rollup primary+others summed by currency == Σ userTransfers per (group, currency)', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.groupRollups.forEach((rollup, groupId) => {
                    const fromRollup = new Map<string, number>();
                    fromRollup.set(rollup.primary.currency, rollup.primary.net);
                    rollup.others.forEach(o =>
                        fromRollup.set(
                            o.currency,
                            (fromRollup.get(o.currency) ?? 0) + o.net,
                        ),
                    );
                    const fromTransfers = new Map<string, number>();
                    d.userTransfers
                        .filter(t => t.groupId === groupId)
                        .forEach(t => {
                            const sign = t.toUserId === me ? 1 : -1;
                            fromTransfers.set(
                                t.currency,
                                (fromTransfers.get(t.currency) ?? 0) + sign * t.amount,
                            );
                        });
                    fromRollup.forEach((net, cur) => {
                        expect(round2(net)).toBeCloseTo(
                            round2(fromTransfers.get(cur) ?? 0),
                            2,
                        );
                    });
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 2: friendBalances.byCurrency == Σ userTransfers per (friend, currency)', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.friendBalances.forEach((friend, friendId) => {
                    const fromTransfers = new Map<string, number>();
                    d.userTransfers
                        .filter(
                            t =>
                                t.fromUserId === friendId ||
                                t.toUserId === friendId,
                        )
                        .forEach(t => {
                            const sign = t.toUserId === me ? 1 : -1;
                            fromTransfers.set(
                                t.currency,
                                (fromTransfers.get(t.currency) ?? 0) + sign * t.amount,
                            );
                        });
                    friend.byCurrency.forEach(({ currency, net }) => {
                        expect(round2(net)).toBeCloseTo(
                            round2(fromTransfers.get(currency) ?? 0),
                            2,
                        );
                    });
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 3: every transfer.amount > 0 and fromUserId ≠ toUserId', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const d = deriveSimplifiedDebts(payload, 'u_0');
                d.transfers.forEach(t => {
                    expect(t.amount).toBeGreaterThan(0);
                    expect(t.fromUserId).not.toBe(t.toUserId);
                });
            }),
            { numRuns: 200 },
        );
    });

    it('inv 4: friendBalances entry equals the byGroupCurrency slice restricted to (me, friend)', () => {
        fc.assert(
            fc.property(arbPayload, payload => {
                const me = 'u_0';
                const d = deriveSimplifiedDebts(payload, me);
                d.friendBalances.forEach((friend, friendId) => {
                    const expected = new Map<string, number>();
                    friend.sharedGroupIds.forEach(gid => {
                        d.byGroupCurrency.get(gid)?.forEach((transfers, cur) => {
                            transfers
                                .filter(
                                    t =>
                                        (t.fromUserId === me &&
                                            t.toUserId === friendId) ||
                                        (t.fromUserId === friendId &&
                                            t.toUserId === me),
                                )
                                .forEach(t => {
                                    const sign = t.toUserId === me ? 1 : -1;
                                    expected.set(
                                        cur,
                                        (expected.get(cur) ?? 0) + sign * t.amount,
                                    );
                                });
                        });
                    });
                    friend.byCurrency.forEach(({ currency, net }) => {
                        expect(round2(net)).toBeCloseTo(
                            round2(expected.get(currency) ?? 0),
                            2,
                        );
                    });
                });
            }),
            { numRuns: 200 },
        );
    });
});
