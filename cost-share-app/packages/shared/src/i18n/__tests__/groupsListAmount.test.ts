import { BIDI_LRI, BIDI_PDI } from '../formatMoney';
import { formatGroupsListAmount, stripPositiveAmountPlusPrefix } from '../groupsListAmount';

describe('groupsListAmount', () => {
    it('stripPositiveAmountPlusPrefix removes leading plus variants', () => {
        expect(stripPositiveAmountPlusPrefix('+ $42')).toBe('$42');
        expect(stripPositiveAmountPlusPrefix(`${BIDI_LRI}+$42${BIDI_PDI}`)).toBe(
            `${BIDI_LRI}$42${BIDI_PDI}`,
        );
    });

    it('formatGroupsListAmount never includes a plus for positive values', () => {
        const out = formatGroupsListAmount(42.5, 'USD', { language: 'en', bidiIsolate: false });
        expect(out).not.toMatch(/\+/);
        expect(out).toMatch(/42/);
    });

    it('formatGroupsListAmount uses magnitude for negative values', () => {
        const out = formatGroupsListAmount(-12, 'ILS', { language: 'he', bidiIsolate: false });
        expect(out).not.toMatch(/\+/);
        expect(out).toMatch(/12/);
    });

    it('places currency symbols via Intl for English (USD)', () => {
        const out = formatGroupsListAmount(86419.76, 'USD', { language: 'en', bidiIsolate: false });
        expect(out).toMatch(/\$/);
        expect(out).toMatch(/86,419\.76|86419\.76/);
        expect(out).not.toMatch(/86,419\.76\$$/);
    });

    it('places currency symbols via Intl for Hebrew (ILS)', () => {
        const out = formatGroupsListAmount(761.5, 'ILS', { language: 'he', bidiIsolate: false });
        expect(out).toMatch(/761/);
        expect(out).toMatch(/₪|ILS/);
    });
});
