import { parseE2eFixtureLocaleFromUrl } from '../../lib/e2eFixtureLocaleLink';

describe('parseE2eFixtureLocaleFromUrl', () => {
    const prev = process.env.EXPO_PUBLIC_E2E_FIXTURES;

    beforeAll(() => {
        process.env.EXPO_PUBLIC_E2E_FIXTURES = '1';
    });

    afterAll(() => {
        process.env.EXPO_PUBLIC_E2E_FIXTURES = prev;
    });

    it('parses locale query on e2e-fixture host', () => {
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://e2e-fixture?locale=he')).toBe('he');
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://e2e-fixture?locale=en')).toBe('en');
    });

    it('ignores unrelated URLs', () => {
        expect(parseE2eFixtureLocaleFromUrl('com.kupapay.mobile://auth/callback')).toBeNull();
        expect(parseE2eFixtureLocaleFromUrl(null)).toBeNull();
    });
});
