import en from './locales/en.json';
import { expandPseudoLongJson } from '../lib/xxLongPseudoLocale';

/** Pseudo-locale code for E2E overflow testing (not a store language). */
export const XX_LONG_LOCALE_CODE = 'xx-long' as const;

export type XxLongLocaleCode = typeof XX_LONG_LOCALE_CODE;

let cached: object | null = null;

/** English-derived pseudo-long bundle; generated at runtime from en.json. */
export function getXxLongTranslation(): object {
    if (!cached) {
        cached = expandPseudoLongJson(en) as object;
    }
    return cached;
}
