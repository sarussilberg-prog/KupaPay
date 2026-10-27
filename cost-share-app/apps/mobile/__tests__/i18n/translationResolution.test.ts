import i18n from 'i18next';
import { MOBILE_I18N_LOCALE_CODES } from '../../i18n/localeConfig';
import { mobileI18nResourcesAllLocales } from '../../i18n/testLocaleResources';

const RESOLVE_SPOT_CHECK_KEYS = ['groups.card.updatedAgo', 'groups.memberCount'] as const;

describe('i18n resolves UI keys (not raw key paths)', () => {
    beforeAll(async () => {
        await i18n.init({
            resources: mobileI18nResourcesAllLocales,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
        });
    });

    it.each(MOBILE_I18N_LOCALE_CODES)('%s resolves groups.card.updatedAgo with interpolation', async locale => {
        await i18n.changeLanguage(locale);
        const out = i18n.t('groups.card.updatedAgo', { when: 'TEST_WHEN' });
        expect(out).not.toBe('groups.card.updatedAgo');
        expect(out).toContain('TEST_WHEN');
    });

    it.each(MOBILE_I18N_LOCALE_CODES)('%s resolves spot-check keys', async locale => {
        await i18n.changeLanguage(locale);
        for (const key of RESOLVE_SPOT_CHECK_KEYS) {
            const opts =
                key === 'groups.memberCount'
                    ? { count: 2 }
                    : key === 'groups.card.updatedAgo'
                      ? { when: 'x' }
                      : undefined;
            const out = i18n.t(key, opts);
            expect(out).not.toBe(key);
        }
    });
});
