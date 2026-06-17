import type { GroupBalance, GroupBalanceOther } from '../types';
import { convertToBaseCurrency, type RatesFromBase } from './fxConversion';

export type GroupBalanceDisplay = {
    /** Net in the chosen display currency (positive = I'm owed, negative = I owe). */
    net: number;
    /** Currency the `net` is expressed in. */
    currency: string;
    /** True when `net` was converted from the group's currency to the user's default. */
    isConverted: boolean;
    /** True when FX was needed but no rate was available — we fell back to the group's currency. */
    conversionFailed?: boolean;
};

/** Primary + secondary currency rows resolved for display, for a single group. */
export type GroupBalanceDisplayBundle = {
    primary: GroupBalanceDisplay;
    others: GroupBalanceDisplay[];
};

function roundMoney(value: number): number {
    return Number(value.toFixed(2));
}

function resolveSingle(
    net: number,
    sourceCurrency: string,
    defaultCurrency: string,
    ratesFromBase?: RatesFromBase,
): GroupBalanceDisplay {
    if (sourceCurrency === defaultCurrency) {
        return { net, currency: defaultCurrency, isConverted: false };
    }
    if (Math.abs(net) < 0.01) {
        return { net: 0, currency: defaultCurrency, isConverted: false };
    }
    if (!ratesFromBase) {
        return {
            net,
            currency: sourceCurrency,
            isConverted: false,
            conversionFailed: true,
        };
    }
    const converted = convertToBaseCurrency(
        Math.abs(net),
        sourceCurrency,
        defaultCurrency,
        ratesFromBase,
    );
    if (converted === null) {
        return {
            net,
            currency: sourceCurrency,
            isConverted: false,
            conversionFailed: true,
        };
    }
    return {
        net: roundMoney(net >= 0 ? converted : -converted),
        currency: defaultCurrency,
        isConverted: true,
    };
}

/**
 * Choose how a single group's net balance should be displayed for the current user.
 * Same currency → render as-is; foreign currency → convert to `defaultCurrency` if a rate is available,
 * otherwise fall back to the group's currency and mark `conversionFailed`.
 */
export function resolveGroupBalanceDisplay(
    balance: GroupBalance | undefined,
    defaultCurrency: string,
    ratesFromBase?: RatesFromBase,
): GroupBalanceDisplay | undefined {
    if (!balance) return undefined;
    return resolveSingle(balance.net, balance.currency, defaultCurrency, ratesFromBase);
}

/**
 * Resolve a group's primary balance plus any secondary per-currency balances
 * for display. The primary entry is FX-converted to `defaultCurrency` when a
 * rate is available; each `others` entry is resolved independently with the
 * same rules.
 */
export function resolveGroupBalanceDisplayBundle(
    balance: GroupBalance | undefined,
    defaultCurrency: string,
    ratesFromBase?: RatesFromBase,
): GroupBalanceDisplayBundle | undefined {
    if (!balance) return undefined;
    const primary = resolveSingle(
        balance.net,
        balance.currency,
        defaultCurrency,
        ratesFromBase,
    );
    const others: GroupBalanceDisplay[] = (balance.others ?? [])
        .map((o: GroupBalanceOther) =>
            resolveSingle(o.net, o.currency, defaultCurrency, ratesFromBase),
        )
        .filter(d => Math.abs(d.net) >= 0.01);
    return { primary, others };
}

/** Foreign currencies (vs. `defaultCurrency`) across all groups that have a non-zero net. */
export function collectGroupFxCurrencies(
    balances: GroupBalance[],
    defaultCurrency: string,
): string[] {
    const set = new Set<string>();
    for (const b of balances) {
        if (!b) continue;
        if (b.currency !== defaultCurrency && Math.abs(b.net) >= 0.01) {
            set.add(b.currency);
        }
        for (const o of b.others ?? []) {
            if (o.currency !== defaultCurrency && Math.abs(o.net) >= 0.01) {
                set.add(o.currency);
            }
        }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * For the groups list: each group's `defaultCurrency` is the display base;
 * map base → balance currencies that need FX conversion into that base.
 */
export function collectGroupListFxBases(
    balances: GroupBalance[],
    defaultCurrencyByGroupId: Record<string, string | undefined>,
): Map<string, string[]> {
    const byBase = new Map<string, Set<string>>();
    const add = (base: string, currency: string, net: number) => {
        if (currency === base || Math.abs(net) < 0.01) return;
        let set = byBase.get(base);
        if (!set) {
            set = new Set();
            byBase.set(base, set);
        }
        set.add(currency);
    };
    for (const b of balances) {
        const base = defaultCurrencyByGroupId[b.groupId];
        if (!base) continue;
        add(base, b.currency, b.net);
        for (const o of b.others ?? []) {
            add(base, o.currency, o.net);
        }
    }
    const out = new Map<string, string[]>();
    byBase.forEach((set, base) => {
        out.set(base, [...set].sort((a, c) => a.localeCompare(c)));
    });
    return out;
}
