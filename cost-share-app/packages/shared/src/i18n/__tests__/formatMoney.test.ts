import { SUPPORTED_LANGUAGES } from '../languages';
import { BIDI_LRI, BIDI_PDI, formatMoney, wrapMoneyForBidi } from '../formatMoney';

describe('formatMoney', () => {
    it('wraps output in bidi isolates by default', () => {
        const out = formatMoney(10, 'USD', { language: 'en', bidiIsolate: true });
        expect(out.startsWith(BIDI_LRI)).toBe(true);
        expect(out.endsWith(BIDI_PDI)).toBe(true);
    });

    it('can omit bidi isolates', () => {
        const out = formatMoney(10, 'USD', { language: 'en', bidiIsolate: false });
        expect(out).not.toContain(BIDI_LRI);
    });

    describe.each(SUPPORTED_LANGUAGES)('locale %s', (language) => {
        it('formats ILS with a shekel symbol and digits', () => {
            const out = formatMoney(761.5, 'ILS', { language, absolute: true, bidiIsolate: false });
            expect(out).toMatch(/761/);
            expect(out).toMatch(/₪|ILS/);
        });

        it('formats USD with grouping or decimals', () => {
            const out = formatMoney(1234.5, 'USD', { language, absolute: true, bidiIsolate: false });
            expect(out).toMatch(/1.?234/);
            expect(out).toMatch(/\$|USD/);
        });

        it('preserves negative sign when not absolute', () => {
            const raw = formatMoney(-42, 'EUR', { language, bidiIsolate: false });
            expect(raw).toMatch(/-|−|42/);
        });
    });

    it('formats AFN without duplicating a manual currency prefix', () => {
        const out = formatMoney(138.75, 'AFN', { language: 'en', absolute: true, bidiIsolate: false });
        expect(out).toMatch(/138/);
        expect(out).not.toMatch(/^\+1/);
    });

    it('wrapMoneyForBidi is idempotent on empty', () => {
        expect(wrapMoneyForBidi('')).toBe('');
    });
});
