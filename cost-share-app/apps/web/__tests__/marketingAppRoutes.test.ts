import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WEB_APP_LOGIN_PATH,
    localePrefixedAppEntryRedirects,
} from '../lib/marketingAppRoutes';

test('WEB_APP_LOGIN_PATH is the canonical sign-in URL', () => {
    assert.equal(WEB_APP_LOGIN_PATH, '/login');
});

test('localePrefixedAppEntryRedirects maps /he/login to /login', () => {
    const redirects = localePrefixedAppEntryRedirects();
    assert.ok(
        redirects.some(
            (rule) => rule.source.includes('he') && rule.destination === '/login',
        ),
    );
    const heLogin = redirects.find((rule) => rule.destination === '/login' && !rule.source.includes(':path*'));
    assert.ok(heLogin);
    assert.match(heLogin!.source, /\/:locale\(/);
});
