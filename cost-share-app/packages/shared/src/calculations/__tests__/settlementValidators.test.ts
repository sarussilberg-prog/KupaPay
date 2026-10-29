import type { UserBalance } from '../../types';
import { validateSettlementAmount } from '../index';

function balance(userId: string, netBalance: number): UserBalance {
    return {
        groupId: 'g1',
        userId,
        currency: 'USD',
        totalPaid: 0,
        totalOwed: 0,
        totalSettledPaid: 0,
        totalSettledReceived: 0,
        netBalance,
    };
}

describe('validateSettlementAmount', () => {
    const balances = [balance('alice', 50), balance('bob', -30), balance('carol', -20)];

    it('rejects when payer is not in debt', () => {
        const result = validateSettlementAmount(balances, 'alice', 'bob', 10);
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/does not owe/i);
    });

    it('rejects when recipient is not owed money', () => {
        const result = validateSettlementAmount(balances, 'bob', 'carol', 10);
        expect(result.valid).toBe(false);
        expect(result.message).toMatch(/not owed/i);
    });

    it('rejects unknown users', () => {
        expect(validateSettlementAmount(balances, 'ghost', 'bob', 5).valid).toBe(false);
        expect(validateSettlementAmount(balances, 'bob', 'ghost', 5).valid).toBe(false);
    });

    it('rejects amount above the pairwise maximum', () => {
        const result = validateSettlementAmount(balances, 'bob', 'alice', 35);
        expect(result.valid).toBe(false);
        expect(result.maxAmount).toBe(30);
        expect(result.message).toMatch(/exceeds maximum/i);
    });

    it('accepts amount at the cap and returns maxAmount', () => {
        const result = validateSettlementAmount(balances, 'bob', 'alice', 30);
        expect(result).toEqual({ valid: true, maxAmount: 30 });
    });

    it('allows one-cent tolerance above max (floating drift)', () => {
        expect(validateSettlementAmount(balances, 'bob', 'alice', 30.01).valid).toBe(true);
    });

    it('accepts partial settlement below the cap', () => {
        expect(validateSettlementAmount(balances, 'carol', 'alice', 15).valid).toBe(true);
    });
});
