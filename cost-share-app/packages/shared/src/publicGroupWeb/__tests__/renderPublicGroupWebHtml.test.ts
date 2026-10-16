import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { renderPublicGroupWebHtml } from '../renderPublicGroupWebHtml';
import type { PublicGroupWebViewPayload } from '../types';

const TOKEN = 'AbCdEfGhIjKl';

const samplePayload: Extract<PublicGroupWebViewPayload, { kind: 'ok' }> = {
    kind: 'ok',
    group: { name: 'Beach trip', currency: 'USD' },
    members: [{ displayName: 'Alex' }, { displayName: 'Sam' }],
    balances: [{ displayName: 'Alex', currency: 'USD', net: 10 }],
    debts: [{ fromName: 'Sam', toName: 'Alex', currency: 'USD', amount: 10 }],
    recentExpenses: [
        {
            description: 'Taxi',
            amount: 20,
            currency: 'USD',
            expenseDate: '2026-10-01',
            paidByName: 'Alex',
        },
    ],
};

describe('renderPublicGroupWebHtml', () => {
    it('includes noindex, OG tags, balances, and app CTAs', () => {
        const html = renderPublicGroupWebHtml({
            locale: 'en',
            token: TOKEN,
            payload: samplePayload,
        });
        expect(html).toContain('noindex,nofollow');
        expect(html).toContain('og:image');
        expect(html).toContain('Beach trip');
        expect(html).toContain('Taxi');
        expect(html).toContain('/login');
        expect(html).toContain(`com.kupapay.mobile://invite/g/${TOKEN}`);
        expect(html).toContain('icon-512.png');
    });

    it.each(SUPPORTED_LANGUAGES)('renders RTL/LTR lang=%s', (locale) => {
        const html = renderPublicGroupWebHtml({ locale, token: TOKEN, payload: samplePayload });
        expect(html).toMatch(new RegExp(`lang="${locale}"`));
        if (locale === 'he' || locale === 'ar') {
            expect(html).toContain('dir="rtl"');
        } else {
            expect(html).toContain('dir="ltr"');
        }
    });
});
