import { BIDI_LRI, BIDI_PDI } from '../formatMoney';
import {
    countNonZeroCurrencyOthers,
    formatExtraCurrenciesChipLabel,
} from '../balanceSemantics';

describe('balanceSemantics', () => {
    describe('countNonZeroCurrencyOthers', () => {
        it('ignores zero-net and primary-currency duplicates', () => {
            const n = countNonZeroCurrencyOthers(
                [
                    { currency: 'USD', net: 0 },
                    { currency: 'USD', net: 12 },
                    { currency: 'EUR', net: 5 },
                ],
                'USD',
            );
            expect(n).toBe(1);
        });

        it('returns 0 when others is empty', () => {
            expect(countNonZeroCurrencyOthers(undefined, 'ILS')).toBe(0);
        });
    });

    describe('formatExtraCurrenciesChipLabel', () => {
        it('returns empty for non-positive count', () => {
            expect(formatExtraCurrenciesChipLabel(0, 'מטבע')).toBe('');
        });

        it('wraps +N in bidi isolates before the localized word (Hebrew)', () => {
            const out = formatExtraCurrenciesChipLabel(1, 'מטבע');
            expect(out).toBe(`${BIDI_LRI}+1${BIDI_PDI} מטבע`);
        });

        it('uses plural word unchanged', () => {
            const out = formatExtraCurrenciesChipLabel(2, 'currencies');
            expect(out).toBe(`${BIDI_LRI}+2${BIDI_PDI} currencies`);
        });
    });
});
