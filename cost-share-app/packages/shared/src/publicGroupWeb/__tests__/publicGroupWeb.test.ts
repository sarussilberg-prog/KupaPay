import { SUPPORTED_LANGUAGES } from '../../i18n/languages';
import { buildPublicGroupViewModel } from '../buildPublicGroupViewModel';
import { renderPublicGroupPageHtml } from '../renderPublicGroupPageHtml';
import type { PublicGroupBalancePageWire } from '../types';

const sampleWire: PublicGroupBalancePageWire = {
    ok: true,
    group: { name: 'Trip', default_currency: 'USD' },
    members: [
        { member_key: 'm0', display_name: 'Alice', redacted: false },
        { member_key: 'm1', display_name: 'Bob', redacted: false },
    ],
    balances_by_currency: [
        {
            currency: 'USD',
            nets: [
                { member_key: 'm0', net: 10 },
                { member_key: 'm1', net: -10 },
            ],
        },
    ],
    recent_expenses: [
        {
            description: 'Taxi',
            amount: 20,
            currency: 'USD',
            expense_date: '2026-10-01',
            paid_by_name: 'Alice',
            paid_by_redacted: false,
        },
    ],
};

describe('public group web page', () => {
    it('builds simplified debts from anon-safe member keys', () => {
        const vm = buildPublicGroupViewModel(sampleWire, 'en');
        expect(vm?.debtsByCurrency[0]?.[0]?.fromName).toBe('Bob');
        expect(vm?.debtsByCurrency[0]?.[0]?.toName).toBe('Alice');
    });

    it('labels former members separately from deleted accounts', () => {
        const wire: PublicGroupBalancePageWire = {
            ...sampleWire,
            members: [
                { member_key: 'm0', display_name: null, redacted: true, is_former: false },
                { member_key: 'm1', display_name: null, redacted: false, is_former: true },
            ],
            balances_by_currency: [],
        };
        const vm = buildPublicGroupViewModel(wire, 'en');
        expect(vm?.memberNameByKey.get('m0')).toBe('Deleted user');
        expect(vm?.memberNameByKey.get('m1')).toBe('Former member');
    });

    it('renders noindex, OG tags, and localized RTL for Hebrew', () => {
        const html = renderPublicGroupPageHtml({
            locale: 'he',
            token: 'AbCdEfGhIjKlMn',
            wire: sampleWire,
            canonicalPath: '/b/AbCdEfGhIjKlMn',
        });
        expect(html).toContain('noindex');
        expect(html).toContain('og:title');
        expect(html).toContain('og:image');
        expect(html).toContain('dir="rtl"');
        expect(html).toContain('מי חייב למי');
    });

    it('covers all seven locales', () => {
        for (const locale of SUPPORTED_LANGUAGES) {
            const html = renderPublicGroupPageHtml({
                locale,
                token: 'AbCdEfGhIjKlMn',
                wire: sampleWire,
                canonicalPath: '/b/AbCdEfGhIjKlMn',
            });
            expect(html).toContain(`lang="${locale}"`);
        }
        const en = renderPublicGroupPageHtml({
            locale: 'en',
            token: 'AbCdEfGhIjKlMn',
            wire: sampleWire,
            canonicalPath: '/b/AbCdEfGhIjKlMn',
        });
        expect(en).toContain('Add an expense on the web');
    });
});
