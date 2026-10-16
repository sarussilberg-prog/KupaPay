import type { PairwiseDebt, SimplifiedDebts, Transfer } from '../types';
import type { RatesFromBase } from './fxConversion';
import {
    resolveFriendDisplayBalance,
    type FriendBalanceDisplay,
} from './friendBalanceDisplay';

export type FriendCurrencyNetLine = {
    currency: string;
    /** Positive = friend owes the current user. Negative = current user owes the friend. */
    netAmount: number;
};

export type FriendCrossGroupNetResult = {
    perCurrency: FriendCurrencyNetLine[];
    weightedInDefault: FriendBalanceDisplay;
};

export type FriendGroupSettlePlan = {
    groupId: string;
    debts: PairwiseDebt[];
    netPayerId: string;
    netReceiverId: string;
    netAmount: number;
    targetCurrency: string;
    settlements: Array<{
        currency: string;
        amount: number;
        exchangeRate: number;
        fromUserId: string;
        toUserId: string;
    }>;
    /** When false, a single native-currency settlement is enough. */
    useConsolidationBatch: boolean;
};

export type FriendCrossGroupSettlePreview = {
    perCurrency: FriendCurrencyNetLine[];
    weightedInDefault: FriendBalanceDisplay;
    targetCurrency: string;
    netPayerId: string;
    netReceiverId: string;
    netAmountInTarget: number;
    groupPlans: FriendGroupSettlePlan[];
    conversionFailed: boolean;
};

function roundMoney(value: number): number {
    return Number(value.toFixed(2));
}

/** Transfers between exactly these two users (either direction). */
export function transfersBetweenUsers(
    transfers: Transfer[],
    userIdA: string,
    userIdB: string,
): Transfer[] {
    return transfers.filter(
        t =>
            (t.fromUserId === userIdA && t.toUserId === userIdB) ||
            (t.fromUserId === userIdB && t.toUserId === userIdA),
    );
}

/** Pairwise transfers between current user and friend from canonical userTransfers. */
export function friendPairTransfers(
    simplified: SimplifiedDebts,
    currentUserId: string,
    friendId: string,
): Transfer[] {
    return transfersBetweenUsers(simplified.userTransfers, currentUserId, friendId);
}

/**
 * Signed net per currency from the current user's perspective
 * (matches FriendGroupBalancesSheet group rollup logic).
 */
export function computeFriendCrossGroupCurrencyLines(
    transfers: Transfer[],
    currentUserId: string,
    friendId: string,
): FriendCurrencyNetLine[] {
    const netByCurrency = new Map<string, number>();
    for (const tx of transfers) {
        let delta = 0;
        if (tx.fromUserId === currentUserId && tx.toUserId === friendId) {
            delta = -tx.amount;
        } else if (tx.fromUserId === friendId && tx.toUserId === currentUserId) {
            delta = tx.amount;
        } else {
            continue;
        }
        netByCurrency.set(tx.currency, (netByCurrency.get(tx.currency) ?? 0) + delta);
    }
    return [...netByCurrency.entries()]
        .map(([currency, netAmount]) => ({ currency, netAmount: roundMoney(netAmount) }))
        .filter(l => Math.abs(l.netAmount) >= 0.01)
        .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function computeFriendCrossGroupNet(
    simplified: SimplifiedDebts,
    currentUserId: string,
    friendId: string,
    defaultCurrency: string,
    ratesFromBase?: RatesFromBase,
): FriendCrossGroupNetResult {
    const transfers = friendPairTransfers(simplified, currentUserId, friendId);
    const perCurrency = computeFriendCrossGroupCurrencyLines(
        transfers,
        currentUserId,
        friendId,
    );
    const weightedInDefault = resolveFriendDisplayBalance(
        perCurrency.map(r => ({ currency: r.currency, netBalance: r.netAmount })),
        defaultCurrency,
        ratesFromBase,
    );
    return { perCurrency, weightedInDefault };
}

/** Convert between two currencies using rates where 1 `baseCurrency` = rates[X] units of X. */
export function convertAmountViaBase(
    amount: number,
    from: string,
    to: string,
    baseCurrency: string,
    ratesFromBase: RatesFromBase,
): number | null {
    if (from === to) return roundMoney(amount);
    let inBase: number;
    if (from === baseCurrency) {
        inBase = amount;
    } else {
        const rate = ratesFromBase[from];
        if (!rate || rate <= 0 || !Number.isFinite(rate)) return null;
        inBase = amount / rate;
    }
    if (to === baseCurrency) return roundMoney(inBase);
    const toRate = ratesFromBase[to];
    if (!toRate || toRate <= 0 || !Number.isFinite(toRate)) return null;
    return roundMoney(inBase * toRate);
}

function debtSign(debt: PairwiseDebt, refUserId: string): 1 | -1 {
    return debt.toUserId === refUserId ? 1 : -1;
}

function transfersToPairwiseDebts(transfers: Transfer[]): PairwiseDebt[] {
    return transfers.map(t => ({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        currency: t.currency,
        amount: t.amount,
    }));
}

function groupPairTransfers(
    simplified: SimplifiedDebts,
    currentUserId: string,
    friendId: string,
    groupId: string,
): Transfer[] {
    return friendPairTransfers(simplified, currentUserId, friendId).filter(
        t => t.groupId === groupId,
    );
}

function buildGroupPlan(
    groupId: string,
    transfers: Transfer[],
    currentUserId: string,
    friendId: string,
    targetCurrency: string,
    baseCurrency: string,
    ratesFromBase: RatesFromBase,
): FriendGroupSettlePlan | null {
    const debts = transfersToPairwiseDebts(transfers);
    if (debts.length === 0) return null;

    let signedTotal = 0;
    for (const debt of debts) {
        const sign = debtSign(debt, currentUserId);
        const converted =
            debt.currency === targetCurrency
                ? debt.amount
                : convertAmountViaBase(
                      debt.amount,
                      debt.currency,
                      targetCurrency,
                      baseCurrency,
                      ratesFromBase,
                  );
        if (converted === null) return null;
        signedTotal += sign * converted;
    }
    signedTotal = roundMoney(signedTotal);
    if (Math.abs(signedTotal) < 0.01) return null;

    const netPayerId = signedTotal >= 0 ? friendId : currentUserId;
    const netReceiverId = signedTotal >= 0 ? currentUserId : friendId;
    const netAmount = Math.abs(signedTotal);

    const settlements = debts.map(debt => ({
        currency: debt.currency,
        amount: debt.amount,
        exchangeRate:
            convertAmountViaBase(1, debt.currency, targetCurrency, baseCurrency, ratesFromBase) ??
            1,
        fromUserId: debt.fromUserId,
        toUserId: debt.toUserId,
    }));

    const useConsolidationBatch =
        debts.length > 1 || debts.some(d => d.currency !== targetCurrency);

    return {
        groupId,
        debts,
        netPayerId,
        netReceiverId,
        netAmount,
        targetCurrency,
        settlements,
        useConsolidationBatch,
    };
}

/**
 * Build per-group settle plans and overall net in the chosen target currency.
 */
export function buildFriendCrossGroupSettlePreview(
    simplified: SimplifiedDebts,
    currentUserId: string,
    friendId: string,
    sharedGroupIds: string[],
    defaultCurrency: string,
    targetCurrency: string,
    ratesFromBase?: RatesFromBase,
): FriendCrossGroupSettlePreview {
    const { perCurrency, weightedInDefault } = computeFriendCrossGroupNet(
        simplified,
        currentUserId,
        friendId,
        defaultCurrency,
        ratesFromBase,
    );

    const needsFx =
        targetCurrency !== defaultCurrency ||
        perCurrency.some(l => l.currency !== targetCurrency);

    if (needsFx && !ratesFromBase) {
        return {
            perCurrency,
            weightedInDefault,
            targetCurrency,
            netPayerId: '',
            netReceiverId: '',
            netAmountInTarget: 0,
            groupPlans: [],
            conversionFailed: true,
        };
    }

    const rates = ratesFromBase ?? {};
    const groupPlans: FriendGroupSettlePlan[] = [];
    for (const groupId of sharedGroupIds) {
        const transfers = groupPairTransfers(
            simplified,
            currentUserId,
            friendId,
            groupId,
        );
        const plan = buildGroupPlan(
            groupId,
            transfers,
            currentUserId,
            friendId,
            targetCurrency,
            defaultCurrency,
            rates,
        );
        if (plan) groupPlans.push(plan);
    }

    let globalSigned = 0;
    for (const line of perCurrency) {
        const converted =
            line.currency === targetCurrency
                ? line.netAmount
                : convertAmountViaBase(
                      Math.abs(line.netAmount),
                      line.currency,
                      targetCurrency,
                      defaultCurrency,
                      rates,
                  );
        if (converted === null && line.currency !== targetCurrency) {
            return {
                perCurrency,
                weightedInDefault,
                targetCurrency,
                netPayerId: '',
                netReceiverId: '',
                netAmountInTarget: 0,
                groupPlans: [],
                conversionFailed: true,
            };
        }
        const mag = line.currency === targetCurrency ? line.netAmount : (converted ?? 0);
        globalSigned += line.netAmount >= 0 ? mag : -mag;
    }
    globalSigned = roundMoney(globalSigned);

    const netPayerId = globalSigned >= 0 ? friendId : currentUserId;
    const netReceiverId = globalSigned >= 0 ? currentUserId : friendId;

    return {
        perCurrency,
        weightedInDefault,
        targetCurrency,
        netPayerId,
        netReceiverId,
        netAmountInTarget: Math.abs(globalSigned),
        groupPlans,
        conversionFailed: false,
    };
}

/** Whether payment was recorded in a different currency than the underlying debt. */
export function shouldShowPaidInCurrencyNote(
    paymentCurrency: string,
    debtCurrencies: string[],
): boolean {
    const distinct = new Set(debtCurrencies.filter(Boolean));
    if (distinct.size === 0) return false;
    if (distinct.size === 1 && [...distinct][0] === paymentCurrency) return false;
    return !distinct.has(paymentCurrency) || distinct.size > 1;
}
