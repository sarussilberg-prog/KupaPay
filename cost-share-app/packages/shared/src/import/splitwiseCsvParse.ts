import { parseCsvText } from './parseCsvText';
import type {
    SplitwiseParseResult,
    SplitwiseParsedExpense,
    SplitwiseSkippedRow,
    SplitwiseSkipReason,
} from './splitwiseCsvTypes';

const REQUIRED = ['date', 'description', 'cost', 'currency'] as const;

function normalizeHeader(value: string): string {
    return value.trim().toLowerCase();
}

function parseMoney(raw: string): number | null {
    const cleaned = raw.trim().replace(/,/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return n;
}

function parseSplitwiseDate(raw: string): string | null {
    const s = raw.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (mdy) {
        const month = mdy[1].padStart(2, '0');
        const day = mdy[2].padStart(2, '0');
        return `${mdy[3]}-${month}-${day}`;
    }
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (dmy && dmy[3].length === 4) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        return `${dmy[3]}-${month}-${day}`;
    }
    const parsed = Date.parse(s);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 10);
}

function isTotalBalanceRow(description: string): boolean {
    return /total\s+balance/i.test(description.trim());
}

function isPaymentRow(description: string, category: string | null): boolean {
    if (/^payment$/i.test(category?.trim() ?? '')) return true;
    return /^payment\b/i.test(description.trim());
}

function pickDefaultCurrency(expenses: SplitwiseParsedExpense[]): string {
    const counts = new Map<string, number>();
    for (const e of expenses) {
        counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
    }
    let best = 'USD';
    let bestCount = 0;
    for (const [cur, count] of counts) {
        if (count > bestCount) {
            best = cur;
            bestCount = count;
        }
    }
    return best;
}

function deriveShares(
    cost: number,
    impacts: { name: string; impact: number }[],
): { payer: string; splits: { memberName: string; amount: number }[] } | null {
    const participants = impacts.filter((p) => Math.abs(p.impact) > 0.0001);
    if (participants.length === 0) return null;

    const payers = participants.filter((p) => p.impact > 0);
    if (payers.length === 0) return null;
    const payer = payers.reduce((a, b) => (b.impact > a.impact ? b : a));

    const splits = participants.map((p) => {
        const share = p.impact > 0 ? cost - p.impact : -p.impact;
        return { memberName: p.name, amount: Math.round(share * 100) / 100 };
    });

    const sum = splits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(sum - cost) > 0.02) return null;

    return { payer: payer.name, splits };
}

function skip(
    skipped: SplitwiseSkippedRow[],
    lineNumber: number,
    reason: SplitwiseSkipReason,
    description?: string,
): void {
    skipped.push({ lineNumber, reason, description });
}

export function parseSplitwiseCsvExport(csvText: string): SplitwiseParseResult {
    const rows = parseCsvText(csvText);
    if (rows.length === 0) {
        return { ok: false, error: 'empty_file' };
    }

    const header = rows[0].map((h) => h.trim());
    const headerNorm = header.map(normalizeHeader);
    const colIndex = new Map<string, number>();
    headerNorm.forEach((name, idx) => {
        if (name) colIndex.set(name, idx);
    });

    for (const req of REQUIRED) {
        if (!colIndex.has(req)) {
            return { ok: false, error: 'missing_required_columns' };
        }
    }

    const categoryIdx = colIndex.get('category');
    const currencyIdx = colIndex.get('currency')!;
    const fixedMax = Math.max(
        colIndex.get('date')!,
        colIndex.get('description')!,
        colIndex.get('cost')!,
        currencyIdx,
        categoryIdx ?? 0,
    );

    const memberColumns: { name: string; index: number }[] = [];
    for (let i = fixedMax + 1; i < header.length; i += 1) {
        const name = header[i]?.trim();
        if (name) memberColumns.push({ name, index: i });
    }

    if (memberColumns.length === 0) {
        return { ok: false, error: 'no_member_columns' };
    }

    const expenses: SplitwiseParsedExpense[] = [];
    const skipped: SplitwiseSkippedRow[] = [];

    for (let r = 1; r < rows.length; r += 1) {
        const lineNumber = r + 1;
        const cells = rows[r];
        if (cells.every((c) => !c.trim())) continue;

        const description = (cells[colIndex.get('description')!] ?? '').trim();
        const category =
            categoryIdx !== undefined ? (cells[categoryIdx] ?? '').trim() || null : null;

        if (isTotalBalanceRow(description)) {
            skip(skipped, lineNumber, 'total_balance_row', description);
            continue;
        }
        if (isPaymentRow(description, category)) {
            skip(skipped, lineNumber, 'payment_row', description);
            continue;
        }

        if (cells.length < header.length) {
            skip(skipped, lineNumber, 'column_mismatch', description);
            continue;
        }

        const cost = parseMoney(cells[colIndex.get('cost')!] ?? '');
        if (cost === null) {
            skip(skipped, lineNumber, 'invalid_cost', description);
            continue;
        }
        if (Math.abs(cost) < 0.0001) {
            skip(skipped, lineNumber, 'zero_cost', description);
            continue;
        }

        const currencyRaw = (cells[currencyIdx] ?? '').trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currencyRaw)) {
            skip(skipped, lineNumber, 'invalid_currency', description);
            continue;
        }

        const expenseDate = parseSplitwiseDate(cells[colIndex.get('date')!] ?? '');
        if (!expenseDate) {
            skip(skipped, lineNumber, 'invalid_date', description);
            continue;
        }

        const impacts: { name: string; impact: number }[] = [];
        for (const col of memberColumns) {
            const impact = parseMoney(cells[col.index] ?? '');
            if (impact === null) {
                skip(skipped, lineNumber, 'column_mismatch', description);
                impacts.length = 0;
                break;
            }
            impacts.push({ name: col.name, impact });
        }
        if (impacts.length === 0) continue;

        const derived = deriveShares(cost, impacts);
        if (!derived) {
            const reason: SplitwiseSkipReason =
                impacts.every((p) => Math.abs(p.impact) < 0.0001)
                    ? 'no_participants'
                    : impacts.some((p) => p.impact > 0)
                      ? 'unbalanced_row'
                      : 'missing_payer';
            skip(skipped, lineNumber, reason, description);
            continue;
        }

        expenses.push({
            lineNumber,
            expenseDate,
            description: description || category || 'Expense',
            category,
            amount: cost,
            currency: currencyRaw,
            payerMemberName: derived.payer,
            splits: derived.splits,
        });
    }

    return {
        ok: true,
        members: memberColumns.map((c) => c.name),
        expenses,
        skipped,
        defaultCurrency: pickDefaultCurrency(expenses),
    };
}
