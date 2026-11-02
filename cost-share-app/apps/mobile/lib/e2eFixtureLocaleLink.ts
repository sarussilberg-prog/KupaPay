import * as Linking from 'expo-linking';
import { isLanguage, type Language } from '@cost-share/shared';
import { isE2eLayoutFixturesEnabled } from './e2eLayoutFixtures';

/** Maestro: `com.kupapay.mobile://e2e-fixture?locale=he` (Modal language sheet is not reliably visible to Maestro). */
export function parseE2eFixtureLocaleFromUrl(url: string | null | undefined): Language | null {
    if (!url?.trim() || !isE2eLayoutFixturesEnabled()) return null;
    const parsed = Linking.parse(url);
    const host = parsed.hostname ?? '';
    const path = parsed.path ?? '';
    const isFixtureHost = host === 'e2e-fixture' || path.includes('e2e-fixture');
    if (!isFixtureHost) return null;
    const raw = parsed.queryParams?.locale ?? parsed.queryParams?.lang;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return null;
    return isLanguage(value) ? value : null;
}
