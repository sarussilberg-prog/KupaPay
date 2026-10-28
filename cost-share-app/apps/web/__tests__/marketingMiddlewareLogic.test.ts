import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectMarketingLocale,
    normalizeMarketingLang,
    resolveMarketingMiddleware,
} from '../lib/marketingMiddlewareLogic';

test('normalizeMarketingLang accepts region subtags', () => {
    assert.equal(normalizeMarketingLang('he-IL'), 'he');
    assert.equal(normalizeMarketingLang('xx'), null);
});

test('detectMarketingLocale prefers cookie over Accept-Language', () => {
    assert.equal(
        detectMarketingLocale({ cookieLocale: 'fr', acceptLanguage: 'he,en;q=0.9' }),
        'fr',
    );
});

test('resolveMarketingMiddleware redirects / using detected locale', () => {
    const action = resolveMarketingMiddleware('/', {
        cookieLocale: null,
        acceptLanguage: 'ru-RU,ru;q=0.9',
    });
    assert.deepEqual(action, { kind: 'redirect_root', locale: 'ru' });
});

test('resolveMarketingMiddleware sets locale cookie path on marketing locale URLs', () => {
    assert.deepEqual(resolveMarketingMiddleware('/he', { cookieLocale: null, acceptLanguage: null }), {
        kind: 'continue_marketing_locale',
        locale: 'he',
    });
    assert.deepEqual(resolveMarketingMiddleware('/privacy', { cookieLocale: 'en', acceptLanguage: null }), {
        kind: 'pass_through',
    });
});
