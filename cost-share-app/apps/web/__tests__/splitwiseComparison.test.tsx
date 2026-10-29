import test from 'node:test';
import assert from 'node:assert/strict';
import { getTranslations, WEB_I18N_LOCALE_CODES } from '../lib/i18n';
import { buildSplitwiseComparisonPageMetadata } from '../lib/splitwiseComparisonMetadata';
import { SPLITWISE_COMPARISON_AS_OF, SPLITWISE_COMPARISON_SLUG } from '../lib/splitwiseComparisonPages';
import { splitwiseComparisonPath, splitwiseComparisonUrl } from '../lib/marketingSeo';

test('splitwise comparison slug and paths', () => {
    assert.equal(SPLITWISE_COMPARISON_SLUG, 'splitwise-alternative');
    assert.equal(splitwiseComparisonPath('he'), '/he/splitwise-alternative');
    assert.match(splitwiseComparisonUrl('en'), /^https:\/\/kupa-pay\.com\/en\/splitwise-alternative$/);
});

test('comparison metadata includes canonical and hreflang', () => {
    const meta = buildSplitwiseComparisonPageMetadata('en');
    assert.equal(meta.alternates?.canonical, 'https://kupa-pay.com/en/splitwise-alternative');
    const arAlt = meta.alternates?.languages?.ar;
    assert.match(String(arAlt), /\/ar\/splitwise-alternative/);
    assert.match(String(meta.title), /Splitwise/i);
});

test('every web locale has splitwise comparison copy', () => {
    for (const locale of WEB_I18N_LOCALE_CODES) {
        const t = getTranslations(locale);
        assert.ok(t.splitwiseComparison.table.rows.length >= 8, locale);
        assert.ok(t.footer.splitwiseAlternative.length > 0, locale);
    }
});

test('English comparison copy includes as-of placeholder and core rows', () => {
    const page = getTranslations('en').splitwiseComparison;
    assert.equal(SPLITWISE_COMPARISON_AS_OF, '2026-10-29');
    assert.match(page.table.asOfLabel, /\{date\}/);
    assert.ok(page.table.rows.some((row) => /Debt simplification/i.test(row.feature)));
    assert.ok(page.table.rows.some((row) => /Splitwise group CSV/i.test(row.kupapay)));
});

test('Hebrew comparison hero is localized', () => {
    const en = getTranslations('en').splitwiseComparison.hero.headline;
    const he = getTranslations('he').splitwiseComparison.hero.headline;
    assert.notEqual(en, he);
});
