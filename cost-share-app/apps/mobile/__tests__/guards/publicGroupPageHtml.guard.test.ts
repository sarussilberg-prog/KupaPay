import { readFileSync } from 'fs';
import { join } from 'path';
import { renderPublicGroupPageHtml, SUPPORTED_LANGUAGES } from '@cost-share/shared';
import type { PublicGroupBalancePageWire } from '@cost-share/shared';

const ROUTE_PATH = join(__dirname, '../../../web/app/g/[token]/route.ts');

const wire: PublicGroupBalancePageWire = {
    ok: true,
    group: { name: 'Demo', default_currency: 'USD' },
    members: [{ member_key: 'm0', display_name: 'A', redacted: false }],
    balances_by_currency: [],
    recent_expenses: [],
};

describe('public group page HTML (/g/<token>)', () => {
    it('web route delegates to publicGroupPageHtml', () => {
        const src = readFileSync(ROUTE_PATH, 'utf8');
        expect(src).toContain('publicGroupPageHtml');
        expect(src).toContain('noindex');
    });

    it('renders OG preview and no PII hooks for all locales', () => {
        for (const locale of SUPPORTED_LANGUAGES) {
            const html = renderPublicGroupPageHtml({
                locale,
                token: 'AbCdEfGhIjKlMn',
                wire,
                canonicalPath: '/g/AbCdEfGhIjKlMn',
            });
            expect(html).toContain('og:image');
            expect(html).toContain('robots');
        }
    });
});
