import type { PublicExpenseShareWire } from './types';

export function parsePublicExpenseShareWire(raw: unknown): PublicExpenseShareWire {
    if (!raw || typeof raw !== 'object') return { ok: false };
    const row = raw as Record<string, unknown>;
    if (row.ok !== true) return { ok: false };
    return {
        ok: true,
        description: typeof row.description === 'string' ? row.description : undefined,
        amount: row.amount != null ? Number(row.amount) : undefined,
        currency: typeof row.currency === 'string' ? row.currency : undefined,
        expense_date: typeof row.expense_date === 'string' ? row.expense_date : undefined,
        group_name: typeof row.group_name === 'string' ? row.group_name : undefined,
        payer_name: typeof row.payer_name === 'string' ? row.payer_name : undefined,
    };
}
