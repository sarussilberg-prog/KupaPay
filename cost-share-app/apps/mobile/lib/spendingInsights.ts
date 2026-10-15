/** Pro spending insights — pure aggregations over group expenses. */

export interface SpendingInsightExpense {
    amount: number;
    currency: string;
    category?: string | null;
    expenseDate: Date | string;
    paidBy: string;
}

export interface LabeledAmount {
    key: string;
    total: number;
    currency: string;
}

export interface TimeBucketTotal {
    bucketKey: string;
    label: string;
    total: number;
    currency: string;
}

function parseDate(d: Date | string): Date {
    return d instanceof Date ? d : new Date(d);
}

function weekStartKey(d: Date): string {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
    return start.toISOString().slice(0, 10);
}

export function aggregateSpendingByCategory(
    expenses: SpendingInsightExpense[],
    defaultCurrency: string,
): LabeledAmount[] {
    const map = new Map<string, number>();
    for (const e of expenses) {
        if (e.currency !== defaultCurrency) continue;
        const cat = e.category?.trim() || 'other';
        map.set(cat, (map.get(cat) ?? 0) + e.amount);
    }
    return [...map.entries()]
        .map(([key, total]) => ({ key, total: Number(total.toFixed(2)), currency: defaultCurrency }))
        .sort((a, b) => b.total - a.total);
}

export function aggregateSpendingByMember(
    expenses: SpendingInsightExpense[],
    defaultCurrency: string,
): LabeledAmount[] {
    const map = new Map<string, number>();
    for (const e of expenses) {
        if (e.currency !== defaultCurrency) continue;
        map.set(e.paidBy, (map.get(e.paidBy) ?? 0) + e.amount);
    }
    return [...map.entries()]
        .map(([key, total]) => ({ key, total: Number(total.toFixed(2)), currency: defaultCurrency }))
        .sort((a, b) => b.total - a.total);
}

export function aggregateSpendingOverTime(
    expenses: SpendingInsightExpense[],
    defaultCurrency: string,
): TimeBucketTotal[] {
    const map = new Map<string, number>();
    for (const e of expenses) {
        if (e.currency !== defaultCurrency) continue;
        const key = weekStartKey(parseDate(e.expenseDate));
        map.set(key, (map.get(key) ?? 0) + e.amount);
    }
    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bucketKey, total]) => ({
            bucketKey,
            label: bucketKey,
            total: Number(total.toFixed(2)),
            currency: defaultCurrency,
        }));
}

export function maxInsightTotal(rows: Array<{ total: number }>): number {
    return rows.reduce((m, r) => Math.max(m, r.total), 0) || 1;
}
