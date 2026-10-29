import test from 'node:test';
import assert from 'node:assert/strict';
import sitemap from '../app/sitemap';
import { getTranslations, WEB_I18N_LOCALE_CODES } from '../lib/i18n';
import { buildTravelGuidePageMetadata, buildTravelGuidesIndexMetadata } from '../lib/travelGuidesMetadata';
import {
    TRAVEL_GUIDE_IDS,
    TRAVEL_GUIDE_SLUGS,
    TRAVEL_GUIDES_INDEX_SLUG,
    isTravelGuideSlug,
    travelGuideIdFromSlug,
} from '../lib/travelGuidesPages';
import {
    travelGuidePath,
    travelGuideUrl,
    travelGuidesIndexPath,
    travelGuidesIndexUrl,
} from '../lib/marketingSeo';

test('travel guide slugs map to ids', () => {
    for (const id of TRAVEL_GUIDE_IDS) {
        const slug = TRAVEL_GUIDE_SLUGS[id];
        assert.equal(isTravelGuideSlug(slug), true);
        assert.equal(travelGuideIdFromSlug(slug), id);
    }
    assert.equal(TRAVEL_GUIDE_IDS.length, 10);
    assert.equal(TRAVEL_GUIDES_INDEX_SLUG, 'guides');
});

test('travel guide paths and urls include locale', () => {
    assert.equal(travelGuidesIndexPath('he'), '/he/guides');
    assert.match(travelGuidesIndexUrl('en'), /^https:\/\/kupa-pay\.com\/en\/guides$/);
    assert.equal(travelGuidePath('en', 'japanTravelMoney'), '/en/guides/japan-travel-money-tips');
    assert.match(travelGuideUrl('fr', 'groupTripSplit'), /^https:\/\/kupa-pay\.com\/fr\/guides\/splitting-costs-on-a-group-trip$/);
});

test('guides index metadata includes canonical and hreflang', () => {
    const meta = buildTravelGuidesIndexMetadata('en');
    assert.equal(meta.alternates?.canonical, 'https://kupa-pay.com/en/guides');
    const arAlt = meta.alternates?.languages?.ar;
    assert.match(String(arAlt), /\/ar\/guides$/);
});

test('guide article metadata includes canonical and hreflang', () => {
    const meta = buildTravelGuidePageMetadata('en', 'ukTravelMoney');
    assert.equal(meta.alternates?.canonical, 'https://kupa-pay.com/en/guides/uk-travel-money-tips');
    const deAlt = meta.alternates?.languages?.de;
    assert.match(String(deAlt), /\/de\/guides\/uk-travel-money-tips$/);
});

test('every web locale has ten travel guides', () => {
    for (const locale of WEB_I18N_LOCALE_CODES) {
        const t = getTranslations(locale);
        assert.ok(t.footer.travelGuides.length > 0, locale);
        assert.equal(Object.keys(t.travelGuides.guides).length, TRAVEL_GUIDE_IDS.length, locale);
        for (const id of TRAVEL_GUIDE_IDS) {
            assert.ok(t.travelGuides.guides[id].tips.length >= 4, `${locale}:${id}`);
        }
    }
});

test('Hebrew travel guides hero is localized', () => {
    const en = getTranslations('en').travelGuides.index.hero.headline;
    const he = getTranslations('he').travelGuides.index.hero.headline;
    assert.notEqual(en, he);
});

test('sitemap includes guides index and articles for each locale', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    assert.ok(urls.includes('https://kupa-pay.com/en/guides'));
    assert.ok(urls.includes('https://kupa-pay.com/he/guides/japan-travel-money-tips'));
    assert.ok(urls.includes('https://kupa-pay.com/ar/guides/splitting-costs-on-a-group-trip'));
    const guideUrls = urls.filter((u) => u.includes('/guides/'));
    assert.equal(guideUrls.length, TRAVEL_GUIDE_IDS.length * WEB_I18N_LOCALE_CODES.length);
});
