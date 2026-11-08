import * as Linking from 'expo-linking';
import {
    parseE2eFixtureLocaleFromUrl,
    parseE2eFixtureNavigationFromUrl,
    parseE2eFixturePseudoLocaleFromUrl,
} from '../../lib/e2eFixtureLocaleLink';

describe('parseE2eFixtureLocaleFromUrl', () => {
    const prevFixtures = process.env.EXPO_PUBLIC_E2E_FIXTURES;
    const prevXxLong = process.env.EXPO_PUBLIC_E2E_XX_LONG_LOCALE;

    beforeAll(() => {
        process.env.EXPO_PUBLIC_E2E_FIXTURES = '1';
        process.env.EXPO_PUBLIC_E2E_XX_LONG_LOCALE = 'true';
    });

    afterAll(() => {
        process.env.EXPO_PUBLIC_E2E_FIXTURES = prevFixtures;
        process.env.EXPO_PUBLIC_E2E_XX_LONG_LOCALE = prevXxLong;
    });

    it('parses locale query on e2e-fixture host', () => {
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://e2e-fixture?locale=he')).toBe('he');
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://e2e-fixture?locale=en')).toBe('en');
    });

    it('ignores unrelated URLs', () => {
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://auth/callback')).toBeNull();
        expect(parseE2eFixtureLocaleFromUrl(null)).toBeNull();
    });

    it('parses alternate Maestro / iOS URL shapes', () => {
        for (const url of [
            'com.kupapay.mobile://e2e-fixture?locale=he',
            'com.kupapay.mobile:/e2e-fixture?locale=he',
            'com.kupapay.mobile://e2e-fixture/?locale=he',
        ]) {
            Linking.parse(url);
            expect(parseE2eFixtureLocaleFromUrl(url)).toBe('he');
        }
    });

    it('detects xx-long pseudo-locale deep links', () => {
        expect(parseE2eFixturePseudoLocaleFromUrl('com.kupapay.mobile://e2e-fixture?lang=xx-long')).toBe(
            true,
        );
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://e2e-fixture?lang=xx-long')).toBeNull();
        expect(
            parseE2eFixtureNavigationFromUrl('com.kupapay.mobile://e2e-fixture?lang=xx-long')
                ?.pseudoLocale,
        ).toBe(true);
    });
});
