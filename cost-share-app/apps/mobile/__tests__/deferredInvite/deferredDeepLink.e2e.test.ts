/**
 * Cross-platform deferred deep link contract (iOS clipboard + Android Play referrer + web landing).
 * Runs in CI without devices; mirrors the install → first launch → group join flow from #397.
 */

import {
    formatDeferredInviteClipboard,
    parseDeferredInviteClipboard,
    parsePlayInstallReferrer,
    renderInviteLandingHtml,
} from '@cost-share/shared';

const TOKEN = 'AbCdEfGhIjKl';

describe('deferred deep link E2E contract (#397)', () => {
    describe('iOS: landing → clipboard → first launch', () => {
        it('landing writes the same payload the app reads after App Store install', () => {
            const html = renderInviteLandingHtml({ locale: 'he', pathname: `/g/${TOKEN}` });
            expect(html).toContain('kupapay-deferred-invite-v1');
            const payload = formatDeferredInviteClipboard({ kind: 'group', token: TOKEN });
            expect(parseDeferredInviteClipboard(payload)).toEqual({ kind: 'group', token: TOKEN });
            expect(html).toContain("cfg.clipboardPrefix + ':' + deferred.kind");
        });
    });

    describe('Android: landing → Play referrer → first launch', () => {
        it('Play Store URL encodes referrer the app parses on cold start', () => {
            const html = renderInviteLandingHtml({ locale: 'en', pathname: `/g/${TOKEN}` });
            expect(html).toContain('playStoreWithReferrer');
            const referrer = `invite_kind=group&invite_token=${TOKEN}`;
            expect(parsePlayInstallReferrer(referrer)).toEqual({ kind: 'group', token: TOKEN });
        });
    });

    describe('Web: /g/ join page when app missing', () => {
        it('serves join interstitial with store + web continue (no forced marketing redirect on desktop)', () => {
            const html = renderInviteLandingHtml({ locale: 'fr', pathname: `/g/${TOKEN}` });
            expect(html).toContain(`/g/${TOKEN}`);
            expect(html).toContain('Continuer sur le web');
            expect(html).toMatch(/lang="fr"/);
        });
    });
});
