import { readFileSync } from 'fs';
import { join } from 'path';

const INVITE_HTML_PATH = join(
    __dirname,
    '../../../web/app/_lib/inviteLandingHtml.ts',
);

describe('invite landing HTML (web /sr /i /g)', () => {
    it('uses the live App Store URL and does not auto-redirect mobile to marketing', () => {
        const src = readFileSync(INVITE_HTML_PATH, 'utf8');
        expect(src).toContain('apps.apple.com/us/app/kupapay/id6780216665');
        expect(src).toMatch(/\(i\|g\|sr\)/);
        expect(src).not.toMatch(
            /setTimeout\(function \(\) \{ location\.replace\(marketing\)/,
        );
    });
});
