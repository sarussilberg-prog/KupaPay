import i18n from 'i18next';
import { MOBILE_I18N_LOCALE_CODES } from '../../i18n/localeConfig';
import { mobileI18nResourcesAllLocales } from '../../i18n/testLocaleResources';

/** Copy surfaced on the groups list screen (header, summary, cards, filters). */
const GROUPS_LIST_KEYS = [
    'groups.listTitle',
    'groups.createGroup',
    'groups.filters.title',
    'groups.filters.close',
    'groups.card.settled',
    'groups.card.youSettled',
    'groups.card.youOweCaption',
    'groups.card.owedToYouCaption',
    'groups.card.balanceUnavailable',
    'groups.listSummary.otherCurrenciesHint',
    'dashboard.netBalance',
    'dashboard.netYouOwe',
    'dashboard.netOwedToYou',
    'groups.memberCount',
    'groups.card.updatedAgo',
    'common.search',
] as const;

const DEFAULT_OPTS: Record<string, unknown> = {
    count: 2,
    when: 'T',
};

function isResolved(key: string, locale: string): boolean {
    void i18n.changeLanguage(locale);
    const opts = { ...DEFAULT_OPTS, defaultValue: '' };
    const out = i18n.t(key, opts);
    return out !== key && !out.startsWith(`${key}_`) && out.length > 0;
}

describe('groups list locale keys (#616)', () => {
    beforeAll(async () => {
        await i18n.init({
            resources: mobileI18nResourcesAllLocales,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
        });
    });

    it.each(MOBILE_I18N_LOCALE_CODES)('%s resolves groups list UI keys', locale => {
        const missing = GROUPS_LIST_KEYS.filter(key => !isResolved(key, locale));
        expect(missing).toEqual([]);
    });
});
