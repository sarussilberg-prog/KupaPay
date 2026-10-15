import { parseReceiptDraftFromText } from '../receiptDraftFromText';

describe('parseReceiptDraftFromText', () => {
    it('extracts amount, currency, date, and merchant', () => {
        const draft = parseReceiptDraftFromText(
            'Cafe Roma\n12/06/2026\nTotal: ₪84.50\nThank you',
        );
        expect(draft.amount).toBe(84.5);
        expect(draft.currency).toBe('ILS');
        expect(draft.expenseDate).toBe('2026-06-12');
        expect(draft.merchant).toBe('Cafe Roma');
    });
});
