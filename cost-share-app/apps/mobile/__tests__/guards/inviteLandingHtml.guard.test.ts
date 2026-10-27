import { readFileSync } from 'fs';
import { join } from 'path';
import { renderInviteLandingHtml, SUPPORTED_LANGUAGES } from '@cost-share/shared';

const INVITE_HTML_PATH = join(
    __dirname,
    '../../../web/app/_lib/inviteLandingHtml.ts',
);

describe('invite landing HTML (web /sr /i /g)', () => {
    it('delegates rendering to shared deferred-invite module', () => {
        const src = readFileSync(INVITE_HTML_PATH, 'utf8');
        expect(src).toContain('@cost-share/shared');
        expect(src).toContain('renderInviteLandingHtml');
    });

    it('uses the live App Store URL and deferred deep link hooks', () => {
        const html = renderInviteLandingHtml({
            locale: 'en',
            pathname: '/g/AbCdEfGhIjKl',
        });
        expect(html).toContain('apps.apple.com/us/app/kupapay/id6780216665');
        expect(html).toContain('kupapay-deferred-invite-v1');
        expect(html).toContain('invite_kind');
        expect(html).not.toMatch(
            /setTimeout\(function \(\) \{ location\.replace\(marketing\)/,
        );
    });

    it('supports all seven locales with localized copy (not Hebrew-only)', () => {
        const en = renderInviteLandingHtml({ locale: 'en', pathname: '/g/AbCdEfGhIjKl' });
        expect(en).toContain('Opening the app');
        expect(en).not.toContain('פותח את האפליקציה');

        for (const locale of SUPPORTED_LANGUAGES) {
            const html = renderInviteLandingHtml({
                locale,
                pathname: '/g/AbCdEfGhIjKl',
            });
            expect(html).toContain(`lang="${locale}"`);
        }

        const he = renderInviteLandingHtml({ locale: 'he', pathname: '/g/AbCdEfGhIjKl' });
        expect(he).toContain('פותח את האפליקציה');
        expect(he).toContain('dir="rtl"');
    });
});
