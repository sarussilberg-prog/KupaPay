import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isAscScreenshotDemo } from '../lib/ascScreenshotDemo';
import { ascCaptureExchangeRates } from '../screenshotDemo/ascCaptureFixtures';

const CACHE_PREFIX = 'fx_rates_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Browser-safe (CORS *). Same rate semantics as Frankfurter: units of symbol per 1 base. */
const OPEN_ER_API = 'https://open.er-api.com/v6/latest';

/** Native-only fallback when open.er-api is unavailable. */
const FRANKFURTER_BASE = 'https://api.frankfurter.app';

export type ExchangeRatesPayload = {
    date: string;
    rates: Record<string, number>;
};

type CachedEntry = ExchangeRatesPayload & { fetchedAt: number };

type OpenErApiResponse = {
    result: string;
    base_code: string;
    /** v6 free API uses `rates`; older docs used `conversion_rates`. */
    rates?: Record<string, number>;
    conversion_rates?: Record<string, number>;
    time_last_update_unix?: number;
};

type FrankfurterResponse = {
    date?: string;
    rates?: Record<string, number>;
};

function cacheKey(base: string, symbols: string[]): string {
    return `${CACHE_PREFIX}:${base}:${[...symbols].sort((a, b) => a.localeCompare(b)).join(',')}`;
}

async function readCache(base: string, symbols: string[]): Promise<ExchangeRatesPayload | null> {
    try {
        const raw = await AsyncStorage.getItem(cacheKey(base, symbols));
        if (!raw) return null;
        const entry = JSON.parse(raw) as CachedEntry;
        if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
        return { date: entry.date, rates: entry.rates };
    } catch {
        return null;
    }
}

async function writeCache(base: string, symbols: string[], payload: ExchangeRatesPayload): Promise<void> {
    const entry: CachedEntry = { ...payload, fetchedAt: Date.now() };
    await AsyncStorage.setItem(cacheKey(base, symbols), JSON.stringify(entry));
}

function ratesDateFromUnix(unix?: number): string {
    if (!unix) return new Date().toISOString().slice(0, 10);
    return new Date(unix * 1000).toISOString().slice(0, 10);
}

function pickRates(
    baseCurrency: string,
    symbols: string[],
    conversionRates: Record<string, number>,
): Record<string, number> {
    const rates: Record<string, number> = {};
    for (const symbol of symbols) {
        const rate = conversionRates[symbol];
        if (!rate || rate <= 0 || !Number.isFinite(rate)) {
            throw new Error(`Missing exchange rates for: ${symbol}`);
        }
        rates[symbol] = rate;
    }
    return rates;
}

async function fetchFromOpenErApi(baseCurrency: string, symbols: string[]): Promise<ExchangeRatesPayload> {
    const url = `${OPEN_ER_API}/${encodeURIComponent(baseCurrency)}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Exchange rate fetch failed (${res.status})`);
    }

    const json = (await res.json()) as OpenErApiResponse;
    const table = json.rates ?? json.conversion_rates;
    if (json.result !== 'success' || !table) {
        throw new Error('Exchange rate API returned an error');
    }

    return {
        date: ratesDateFromUnix(json.time_last_update_unix),
        rates: pickRates(baseCurrency, symbols, table),
    };
}

async function fetchFromFrankfurter(baseCurrency: string, symbols: string[]): Promise<ExchangeRatesPayload> {
    const url = `${FRANKFURTER_BASE}/latest?from=${encodeURIComponent(baseCurrency)}&to=${symbols.map(encodeURIComponent).join(',')}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Exchange rate fetch failed (${res.status})`);
    }

    const json = (await res.json()) as FrankfurterResponse;
    const rates = json.rates ?? {};
    return {
        date: json.date ?? new Date().toISOString().slice(0, 10),
        rates: pickRates(baseCurrency, symbols, rates),
    };
}

/**
 * Latest FX rates: how many units of each symbol per 1 unit of base.
 * Web uses open.er-api.com (CORS-enabled); native tries open.er-api first, then Frankfurter.
 */
export async function fetchExchangeRates(
    baseCurrency: string,
    symbols: string[],
): Promise<ExchangeRatesPayload> {
    const unique = [...new Set(symbols.filter((s) => s && s !== baseCurrency))];
    if (unique.length === 0) {
        return { date: new Date().toISOString().slice(0, 10), rates: {} };
    }

    if (isAscScreenshotDemo()) {
        return ascCaptureExchangeRates(baseCurrency, unique);
    }

    const cached = await readCache(baseCurrency, unique);
    if (cached) return cached;

    let payload: ExchangeRatesPayload;
    try {
        payload = await fetchFromOpenErApi(baseCurrency, unique);
    } catch (primaryError) {
        if (Platform.OS === 'web') {
            throw primaryError;
        }
        payload = await fetchFromFrankfurter(baseCurrency, unique);
    }

    await writeCache(baseCurrency, unique, payload);
    return payload;
}
