import { parseCsvText } from '../parseCsvText';
import { parseSplitwiseCsvExport } from '../splitwiseCsvParse';
import { buildSplitwiseImportPlan, defaultGuestDisplayNames } from '../splitwiseImportPlan';

const SAMPLE_HEADER =
    'Date,Description,Category,Cost,Currency,Alice,Bob,Charlie';

function row(
    date: string,
    description: string,
    category: string,
    cost: string,
    currency: string,
    alice: string,
    bob: string,
    charlie: string,
): string {
    return `${date},${description},${category},${cost},${currency},${alice},${bob},${charlie}`;
}

describe('parseCsvText', () => {
    it('handles BOM and quoted commas', () => {
        const text = '\uFEFFDate,Description\r\n2026-01-01,"Pizza, large",Food';
        const rows = parseCsvText(text);
        expect(rows[1][1]).toBe('Pizza, large');
    });
});

describe('parseSplitwiseCsvExport', () => {
    it('parses a balanced three-person expense', () => {
        const csv = [
            SAMPLE_HEADER,
            row('2026-03-01', 'Dinner', 'Food', '90.00', 'USD', '-30.00', '-30.00', '60.00'),
        ].join('\n');

        const result = parseSplitwiseCsvExport(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.members).toEqual(['Alice', 'Bob', 'Charlie']);
        expect(result.expenses).toHaveLength(1);
        expect(result.expenses[0]).toMatchObject({
            amount: 90,
            currency: 'USD',
            payerMemberName: 'Charlie',
            expenseDate: '2026-03-01',
        });
        expect(result.expenses[0].splits).toEqual([
            { memberName: 'Alice', amount: 30 },
            { memberName: 'Bob', amount: 30 },
            { memberName: 'Charlie', amount: 30 },
        ]);
    });

    it('supports multiple currencies', () => {
        const csv = [
            SAMPLE_HEADER,
            row('2026-03-01', 'Taxi', 'Transport', '50', 'EUR', '-25', '25', '0'),
            row('2026-03-02', 'Hotel', 'Lodging', '100', 'USD', '50', '-50', '0'),
        ].join('\n');

        const result = parseSplitwiseCsvExport(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.expenses.map((e) => e.currency)).toEqual(['EUR', 'USD']);
        expect(result.defaultCurrency).toBe('EUR');
    });

    it('skips total balance and payment rows', () => {
        const csv = [
            SAMPLE_HEADER,
            row('2026-03-01', 'Dinner', 'Food', '40', 'USD', '-20', '20', '0'),
            row('', 'Total balance', '', '', '', '10', '-10', '0'),
            row('2026-03-02', 'Payment', 'Payment', '10', 'USD', '-10', '10', '0'),
        ].join('\n');

        const result = parseSplitwiseCsvExport(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.expenses).toHaveLength(1);
        expect(result.skipped.map((s) => s.reason)).toEqual([
            'total_balance_row',
            'payment_row',
        ]);
    });

    it('reports malformed rows', () => {
        const csv = [
            SAMPLE_HEADER,
            row('not-a-date', 'Bad date', 'Food', '10', 'USD', '-5', '5', '0'),
            row('2026-03-01', 'No payer', 'Food', '10', 'USD', '-5', '-5', '0'),
            row('2026-03-01', 'Empty cost', 'Food', '0', 'USD', '0', '0', '0'),
        ].join('\n');

        const result = parseSplitwiseCsvExport(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.expenses).toHaveLength(0);
        expect(result.skipped.map((s) => s.reason)).toEqual([
            'invalid_date',
            'missing_payer',
            'zero_cost',
        ]);
    });

    it('rejects exports without member columns', () => {
        const csv = 'Date,Description,Category,Cost,Currency\n2026-01-01,A,B,1,USD';
        const result = parseSplitwiseCsvExport(csv);
        expect(result).toEqual({ ok: false, error: 'no_member_columns' });
    });
});

describe('buildSplitwiseImportPlan', () => {
    it('maps member names to user ids with custom splits', () => {
        const csv = [
            SAMPLE_HEADER,
            row('2026-03-01', 'Lunch', 'Food', '60', 'ILS', '-20', '-20', '40'),
        ].join('\n');
        const parsed = parseSplitwiseCsvExport(csv);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        const mapping = {
            selfMemberName: 'Bob',
            guestDisplayNames: defaultGuestDisplayNames(parsed.members, 'Bob'),
        };
        const ids = new Map([
            ['Alice', 'user-alice'],
            ['Bob', 'user-bob'],
            ['Charlie', 'user-charlie'],
        ]);

        const built = buildSplitwiseImportPlan(
            'Trip',
            parsed.defaultCurrency,
            parsed.expenses,
            mapping,
            ids,
        );
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        expect(built.plan.expenses[0].paidBy).toBe('user-charlie');
        expect(built.plan.expenses[0].splitMode).toBe('amount');
    });
});
