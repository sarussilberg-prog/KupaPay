import { expandPseudoLongJson, expandPseudoLongString } from '../../lib/xxLongPseudoLocale';
import { getXxLongTranslation, XX_LONG_LOCALE_CODE } from '../../i18n/e2ePseudoLocale';

describe('xx-long pseudo-locale expansion', () => {
    it('expands plain strings by ~40% and adds accents', () => {
        const input = 'Save group';
        const out = expandPseudoLongString(input);
        expect(out.length).toBeGreaterThanOrEqual(Math.ceil(input.length * 1.4));
        expect(out).toMatch(/[àéíóúÀÉÍÓÚ]/);
        expect(out).not.toBe(input);
    });

    it('preserves i18n interpolation tokens while expanding surrounding text', () => {
        const out = expandPseudoLongString('Hello {{name}}');
        expect(out).toContain('{{name}}');
        expect(out.length).toBeGreaterThan('Hello {{name}}'.length);
    });

    it('builds a translation object from en.json', () => {
        const bundle = getXxLongTranslation() as Record<string, unknown>;
        expect(Object.keys(bundle).length).toBeGreaterThan(10);
        expect(XX_LONG_LOCALE_CODE).toBe('xx-long');
    });

    it('expands nested JSON recursively', () => {
        const out = expandPseudoLongJson({ a: 'test', b: ['ok'] }) as {
            a: string;
            b: string[];
        };
        expect(out.a.length).toBeGreaterThan('test'.length);
        expect(out.b[0].length).toBeGreaterThan('ok'.length);
    });
});
