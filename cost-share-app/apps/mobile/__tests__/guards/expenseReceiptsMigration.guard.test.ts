import { readFileSync } from 'fs';
import { join } from 'path';

describe('expense-receipts private migration (KI-033 / #111)', () => {
    const sql = readFileSync(
        join(__dirname, '../../../../supabase/migrations/20261011011000_expense_receipts_private.sql'),
        'utf8',
    );

    it('marks bucket policy drop as safe-breaking and keeps backward-compatible URL migration', () => {
        expect(sql).toContain('safe-breaking');
        expect(sql).toMatch(/UPDATE public\.expenses[\s\S]*receipt_url/);
        expect(sql).toMatch(/public = false/);
    });
});
