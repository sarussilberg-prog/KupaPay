import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchExchangeRates } from '../../services/exchangeRates.service';
import { queryKeys } from './keys';

export const EXCHANGE_RATES_STALE_MS = 24 * 60 * 60 * 1000;

function sortSymbols(base: string, symbols: string[]): string[] {
    return [...new Set(symbols.filter((s) => s && s !== base))].sort((a, b) =>
        a.localeCompare(b),
    );
}

/** Single FX fetch per base + symbol set (shared across profile hero and friend rows). */
export function useExchangeRatesQuery(baseCurrency: string, symbols: string[]) {
    const sorted = useMemo(
        () => sortSymbols(baseCurrency, symbols),
        [baseCurrency, symbols],
    );

    return useQuery({
        queryKey: queryKeys.exchangeRates(baseCurrency, sorted.join(',')),
        queryFn: () => fetchExchangeRates(baseCurrency, sorted),
        enabled: sorted.length > 0,
        staleTime: EXCHANGE_RATES_STALE_MS,
        gcTime: EXCHANGE_RATES_STALE_MS,
        retry: 2,
    });
}
