import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { formatDeferredInviteClipboard, parseDeferredInviteClipboard } from '../clipboardPayload';
import { inviteLandingCopyFor, inviteLandingDir } from '../inviteLandingCopy';
import { encodePlayInstallReferrer, parsePlayInstallReferrer } from '../playInstallReferrer';
import { parseInvitePathFromPathname, toDeferredInvitePayload } from '../parseInvitePath';
import { inviteLandingContextFromPathname, renderInviteLandingHtml } from '../renderInviteLandingHtml';
import { resolveInviteLandingLocale } from '../resolveInviteLandingLocale';
import { playStoreListingUrl } from '../storeUrls';

const SAMPLE_TOKEN = 'AbCdEfGhIjKl';

describe('parseInvitePathFromPathname', () => {
    it('parses group and friend paths', () => {
        expect(parseInvitePathFromPathname('/g/AbCdEfGhIjKl')).toEqual({
            pathKind: 'g',
            kind: 'group',
            token: SAMPLE_TOKEN,
        });
        expect(parseInvitePathFromPathname('/i/AbCdEfGhIjKl')).toEqual({
            pathKind: 'i',
            kind: 'friend',
            token: SAMPLE_TOKEN,
        });
    });

    it('rejects invalid tokens', () => {
        expect(parseInvitePathFromPathname('/g/short')).toBeNull();
    });
});

describe('clipboard deferred invite', () => {
    it('round-trips friend and group payloads', () => {
        const group = { kind: 'group' as const, token: SAMPLE_TOKEN };
        const encoded = formatDeferredInviteClipboard(group);
        expect(parseDeferredInviteClipboard(encoded)).toEqual(group);
    });

    it('ignores unrelated clipboard text', () => {
        expect(parseDeferredInviteClipboard('hello world')).toBeNull();
    });
});

describe('Play Install Referrer', () => {
    it('round-trips invite_kind and invite_token', () => {
        const payload = { kind: 'group' as const, token: SAMPLE_TOKEN };
        const encoded = encodePlayInstallReferrer(payload);
        expect(parsePlayInstallReferrer(encoded)).toEqual(payload);
    });

    it('builds Play Store URL with referrer param', () => {
        const url = playStoreListingUrl({ kind: 'group', token: SAMPLE_TOKEN });
        expect(url).toContain('referrer=');
        expect(decodeURIComponent(url)).toContain('invite_token=AbCdEfGhIjKl');
    });
});

describe('invite landing locale + copy', () => {
    it('registers all seven locales with RTL for he and ar', () => {
        for (const locale of SUPPORTED_LANGUAGES) {
            const copy = inviteLandingCopyFor(locale);
            expect(copy.openApp.length).toBeGreaterThan(0);
            expect(copy.footnote.length).toBeGreaterThan(0);
        }
        expect(inviteLandingDir('he')).toBe('rtl');
        expect(inviteLandingDir('ar')).toBe('rtl');
        expect(inviteLandingDir('en')).toBe('ltr');
    });

    it('honors ?lang= over Accept-Language', () => {
        expect(resolveInviteLandingLocale('en-US,en;q=0.9', 'he')).toBe('he');
        expect(resolveInviteLandingLocale('he-IL,he;q=0.9', null)).toBe('he');
    });
});

describe('renderInviteLandingHtml', () => {
    it('embeds deferred deep link hooks for mobile', () => {
        const html = renderInviteLandingHtml({ locale: 'en', pathname: '/g/AbCdEfGhIjKl' });
        expect(html).toContain('kupapay-deferred-invite-v1');
        expect(html).toContain('invite_kind');
        expect(html).toContain('navigator.clipboard');
        expect(html).toContain('apps.apple.com/us/app/kupapay/id6780216665');
        expect(html).not.toMatch(/lang="he"/);
        expect(html).toContain('dir="ltr"');
    });

    it('does not auto-redirect desktop visitors to marketing', () => {
        const html = renderInviteLandingHtml({ locale: 'en', pathname: '/g/AbCdEfGhIjKl' });
        expect(html).not.toMatch(/if \(!isMobile\) \{\s*location\.replace/);
    });

    it('builds universal link context server-side', () => {
        expect(inviteLandingContextFromPathname('/g/AbCdEfGhIjKl')).toEqual({
            universalUrl: 'https://kupa-pay.com/g/AbCdEfGhIjKl',
            deferred: { kind: 'group', token: SAMPLE_TOKEN },
        });
        expect(toDeferredInvitePayload(parseInvitePathFromPathname('/sr/AbCdEfGhIjKl'))).toBeNull();
    });
});
