import { parseReceiptDraftFromText } from '../parseReceiptDraftFromText';

describe('parseReceiptDraftFromText', () => {
    it('extracts total line amount and USD', () => {
        const draft = parseReceiptDraftFromText(
            'Coffee Shop\nDate 2026-03-01\nSubtotal 10\nTOTAL USD 42.50',
        );
        expect(draft.amount).toBe(42.5);
        expect(draft.currency).toBe('USD');
        expect(draft.expenseDate).toBe('2026-03-01');
        expect(draft.merchant).toBe('Coffee Shop');
    });

    it('handles shekel symbol', () => {
        const draft = parseReceiptDraftFromText('Market\nלתשלום ₪128.00');
        expect(draft.amount).toBe(128);
        expect(draft.currency).toBe('ILS');
    });
});
