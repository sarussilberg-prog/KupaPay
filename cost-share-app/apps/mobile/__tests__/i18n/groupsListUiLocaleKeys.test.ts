import en from '../../i18n/locales/en.json';
import he from '../../i18n/locales/he.json';
import ar from '../../i18n/locales/ar.json';
import ru from '../../i18n/locales/ru.json';
import de from '../../i18n/locales/de.json';
import es from '../../i18n/locales/es.json';
import fr from '../../i18n/locales/fr.json';

const locales = [
    ['en', en],
    ['he', he],
    ['ar', ar],
    ['ru', ru],
    ['de', de],
    ['es', es],
    ['fr', fr],
] as const;

describe('groups list UI strings (7 locales)', () => {
    it.each(locales)('%s defines groups list header + create CTA', (_code, bundle) => {
        expect(bundle.groups.listTitle.length).toBeGreaterThan(0);
        expect(bundle.groups.createGroup.length).toBeGreaterThan(0);
    });
});
