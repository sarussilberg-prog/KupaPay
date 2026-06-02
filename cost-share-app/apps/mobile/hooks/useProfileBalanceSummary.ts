import { useMemo } from 'react';
import {
    aggregateBalanceInBaseCurrency,
    aggregateBalanceWithoutFx,
    BalanceSummary,
} from '@cost-share/shared';
import type { ExchangeRatesPayload } from '../services/exchangeRates.service';

export type ProfileBalanceConversion = {
    isConverted: boolean;
    ratesDate: string | null;
    isLoading: boolean;
    failed: boolean;
};

export type DerivedProfileBalance = {
    summary: BalanceSummary | undefined;
    /** True when at least one foreign-currency row was converted via FX. */
    fxApplied: boolean;
    /** True when foreign rows are present but FX rates haven't (yet) been provided. */
    needsRates: boolean;
};

/**
 * Pure aggregation step extracted from the hook so it can be unit-tested
 * without react-query plumbing. Always renders headline totals in
 * `defaultCurrency`, ignoring anything the server may have placed in
 * `totalOwed`/`totalOwedToUser`. That coupling is what makes the displayed
 * number and the displayed currency tag impossible to mismatch.
 */
export function deriveProfileBalanceSummary(
    raw: BalanceSummary | undefined,
    rates: Record<string, number> | undefined,
): DerivedProfileBalance {
    if (!raw) return { summary: undefined, fxApplied: false, needsRates: false };

    const local = aggregateBalanceWithoutFx(raw.byCurrency, raw.defaultCurrency);
    if (local) {
        return {
            summary: { ...raw, totalOwed: local.totalOwed, totalOwedToUser: local.totalOwedToUser },
            fxApplied: false,
            needsRates: false,
        };
    }

    if (!rates) {
        return {
            summary: { ...raw, totalOwed: null, totalOwedToUser: null },
            fxApplied: false,
            needsRates: true,
        };
    }

    const aggregated = aggregateBalanceInBaseCurrency(raw.byCurrency, raw.defaultCurrency, rates);
    if (!aggregated) {
        return {
            summary: { ...raw, totalOwed: null, totalOwedToUser: null },
            fxApplied: false,
            needsRates: true,
        };
    }

    return {
        summary: {
            ...raw,
            totalOwed: aggregated.totalOwed,
            totalOwedToUser: aggregated.totalOwedToUser,
        },
        fxApplied: true,
        needsRates: false,
    };
}

type FxQueryState = {
    data: ExchangeRatesPayload | undefined;
    isLoading: boolean;
    isError: boolean;
};

/**
 * Headline aggregation for the profile screen. FX is loaded once via
 * `useExchangeRatesQuery` on ProfileScreen and passed in as `fxQuery`.
 */
export function useProfileBalanceSummary(
    raw: BalanceSummary | undefined,
    fxQuery: FxQueryState,
): { summary: BalanceSummary | undefined; conversion: ProfileBalanceConversion } {
    const preview = useMemo(() => deriveProfileBalanceSummary(raw, undefined), [raw]);
    const fxEnabled = preview.needsRates;

    const derived = useMemo(
        () => deriveProfileBalanceSummary(raw, fxQuery.data?.rates),
        [raw, fxQuery.data],
    );

    const conversion: ProfileBalanceConversion = {
        isConverted: derived.fxApplied,
        ratesDate: derived.fxApplied ? fxQuery.data?.date ?? null : null,
        isLoading: fxEnabled && fxQuery.isLoading,
        failed:
            fxEnabled &&
            !fxQuery.isLoading &&
            (fxQuery.isError || !fxQuery.data || derived.needsRates),
    };

    return { summary: derived.summary, conversion };
}
