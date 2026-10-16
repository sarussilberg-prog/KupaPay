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
});
