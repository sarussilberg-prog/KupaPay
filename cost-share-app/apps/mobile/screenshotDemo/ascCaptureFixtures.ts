/**
 * In-memory fixtures for store screenshot capture (never hits production Supabase).
 */
import type { ExpenseWithSplits, GroupMember, User } from '@cost-share/shared';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';
import {
    CAPTURE_GROUP_BARCELONA,
    CAPTURE_USER_ID,
    captureGroups,
    captureSimplifiedInputs,
} from './ascCaptureSeed';

export function inAscCaptureMode(): boolean {
    return isAscScreenshotDemo();
}

export function ascCaptureGroups() {
    return captureGroups;
}

export function ascCaptureSimplifiedInputs() {
    return captureSimplifiedInputs;
}

export function ascCaptureUsersForGroup(groupId: string): User[] {
    const group = captureGroups.find(g => g.id === groupId);
    if (!group) return [];
    const now = new Date('2026-10-01');
    return group.members.map(m => ({
        id: m.userId,
        name: m.displayName,
        email: `${m.userId}@capture.kupapay.local`,
        inviteToken: `tok-${m.userId}`,
        defaultCurrency: group.defaultCurrency,
        language: 'en',
        isActive: true,
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
    }));
}

export function ascCaptureGroupMembers(groupId: string): GroupMember[] {
    const group = captureGroups.find(g => g.id === groupId);
    if (!group) return [];
    const now = new Date('2026-10-01');
    return group.members.map(m => ({
        id: `${groupId}-${m.userId}`,
        groupId,
        userId: m.userId,
        isActive: true,
        joinedAt: now,
    }));
}

export const captureExpenses: ExpenseWithSplits[] = [
    {
        id: 'exp-dinner',
        groupId: CAPTURE_GROUP_BARCELONA,
        description: 'Dinner',
        amount: 480,
        currency: 'ILS',
        category: 'food',
        expenseDate: new Date('2026-10-12'),
        paidBy: CAPTURE_USER_ID,
        createdBy: CAPTURE_USER_ID,
        splitMode: 'equal',
        isDeleted: false,
        createdAt: new Date('2026-10-12'),
        updatedAt: new Date('2026-10-12'),
        splits: [
            { id: 's1', expenseId: 'exp-dinner', userId: CAPTURE_USER_ID, amount: 120, createdAt: new Date('2026-10-12') },
            { id: 's2', expenseId: 'exp-dinner', userId: 'u-dana', amount: 120, createdAt: new Date('2026-10-12') },
            { id: 's3', expenseId: 'exp-dinner', userId: 'u-yoni', amount: 120, createdAt: new Date('2026-10-12') },
            { id: 's4', expenseId: 'exp-dinner', userId: 'u-alex', amount: 120, createdAt: new Date('2026-10-12') },
        ],
    },
    {
        id: 'exp-museum',
        groupId: CAPTURE_GROUP_BARCELONA,
        description: 'Museum tickets',
        amount: 86,
        currency: 'EUR',
        category: 'activities',
        expenseDate: new Date('2026-10-11'),
        paidBy: 'u-dana',
        createdBy: CAPTURE_USER_ID,
        splitMode: 'equal',
        isDeleted: false,
        createdAt: new Date('2026-10-11'),
        updatedAt: new Date('2026-10-11'),
        splits: [
            { id: 's5', expenseId: 'exp-museum', userId: CAPTURE_USER_ID, amount: 21.5, createdAt: new Date('2026-10-11') },
            { id: 's6', expenseId: 'exp-museum', userId: 'u-dana', amount: 21.5, createdAt: new Date('2026-10-11') },
            { id: 's7', expenseId: 'exp-museum', userId: 'u-yoni', amount: 21.5, createdAt: new Date('2026-10-11') },
            { id: 's8', expenseId: 'exp-museum', userId: 'u-alex', amount: 21.5, createdAt: new Date('2026-10-11') },
        ],
    },
    {
        id: 'exp-taxi',
        groupId: CAPTURE_GROUP_BARCELONA,
        description: 'Airport taxi',
        amount: 45,
        currency: 'USD',
        category: 'transport',
        expenseDate: new Date('2026-10-10'),
        paidBy: 'u-yoni',
        createdBy: CAPTURE_USER_ID,
        splitMode: 'equal',
        isDeleted: false,
        createdAt: new Date('2026-10-10'),
        updatedAt: new Date('2026-10-10'),
        splits: [
            { id: 's9', expenseId: 'exp-taxi', userId: CAPTURE_USER_ID, amount: 11.25, createdAt: new Date('2026-10-10') },
            { id: 's10', expenseId: 'exp-taxi', userId: 'u-dana', amount: 11.25, createdAt: new Date('2026-10-10') },
            { id: 's11', expenseId: 'exp-taxi', userId: 'u-yoni', amount: 11.25, createdAt: new Date('2026-10-10') },
            { id: 's12', expenseId: 'exp-taxi', userId: 'u-alex', amount: 11.25, createdAt: new Date('2026-10-10') },
        ],
    },
];

export function ascCaptureExpenses(groupId?: string): ExpenseWithSplits[] {
    if (!groupId) return captureExpenses;
    return captureExpenses.filter(e => e.groupId === groupId);
}

/** Stable FX for marketing screenshots (units of symbol per 1 base). */
export function ascCaptureExchangeRates(
    baseCurrency: string,
    symbols: string[],
): { date: string; rates: Record<string, number> } {
    const table: Record<string, Record<string, number>> = {
        ILS: { EUR: 0.25, USD: 0.27, ILS: 1 },
        EUR: { ILS: 4.0, USD: 1.08, EUR: 1 },
        USD: { ILS: 3.7, EUR: 0.93, USD: 1 },
    };
    const base = table[baseCurrency] ?? table.ILS;
    const rates: Record<string, number> = {};
    for (const sym of symbols) {
        if (sym === baseCurrency) continue;
        rates[sym] = base[sym] ?? 1;
    }
    return { date: '2026-10-01', rates };
}
