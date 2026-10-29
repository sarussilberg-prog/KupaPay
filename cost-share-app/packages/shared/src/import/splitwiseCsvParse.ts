import { parseCsvText } from './parseCsvText';
import type {
    SplitwiseParseResult,
    SplitwiseParsedExpense,
    SplitwiseSkippedRow,
    SplitwiseSkipReason,
} from './splitwiseCsvTypes';

const REQUIRED = ['date', 'description', 'cost', 'currency'] as const;

type MemberColumn = { name: string; index: number };

type SplitwiseColumnMap = {
    date: number;
    description: number;
    cost: number;
    currency: number;
    category?: number;
    members: MemberColumn[];
};

function normalizeHeader(value: string): string {
    return value.trim().toLowerCase();
}

function parseMoney(raw: string): number | null {
    const cleaned = raw.trim().replaceAll(',', '');
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
    if (dmy?.[3]?.length === 4) {
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
    const payer = payers.reduce((a, b) => (b.impact > a.impact ? b : a), payers[0]);

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

function buildColumnMap(header: string[]): SplitwiseColumnMap | null {
    const headerNorm = header.map(normalizeHeader);
    const colIndex = new Map<string, number>();
    headerNorm.forEach((name, idx) => {
        if (name) colIndex.set(name, idx);
    });

    for (const req of REQUIRED) {
        if (!colIndex.has(req)) return null;
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

    const members: MemberColumn[] = [];
    for (let i = fixedMax + 1; i < header.length; i += 1) {
        const name = header[i]?.trim();
        if (name) members.push({ name, index: i });
    }
    if (members.length === 0) return null;

    return {
        date: colIndex.get('date')!,
        description: colIndex.get('description')!,
        cost: colIndex.get('cost')!,
        currency: currencyIdx,
        category: categoryIdx,
        members,
    };
}

function skipReasonForImpacts(impacts: { impact: number }[]): SplitwiseSkipReason {
    if (impacts.every((p) => Math.abs(p.impact) < 0.0001)) return 'no_participants';
    if (impacts.some((p) => p.impact > 0)) return 'unbalanced_row';
    return 'missing_payer';
}

function parseMemberImpacts(
    cells: string[],
    members: MemberColumn[],
    lineNumber: number,
    description: string,
    skipped: SplitwiseSkippedRow[],
): { name: string; impact: number }[] | null {
    const impacts: { name: string; impact: number }[] = [];
    for (const col of members) {
        const impact = parseMoney(cells[col.index] ?? '');
        if (impact === null) {
            skip(skipped, lineNumber, 'column_mismatch', description);
            return null;
        }
        impacts.push({ name: col.name, impact });
    }
    return impacts;
}

function parseSplitwiseDataRow(
    cells: string[],
    headerLength: number,
    columns: SplitwiseColumnMap,
    lineNumber: number,
    skipped: SplitwiseSkippedRow[],
): SplitwiseParsedExpense | null {
    if (cells.every((c) => !c.trim())) return null;

    const description = (cells[columns.description] ?? '').trim();
    const category =
        columns.category !== undefined
            ? (cells[columns.category] ?? '').trim() || null
            : null;

    if (isTotalBalanceRow(description)) {
        skip(skipped, lineNumber, 'total_balance_row', description);
        return null;
    }
    if (isPaymentRow(description, category)) {
        skip(skipped, lineNumber, 'payment_row', description);
        return null;
    }
    if (cells.length < headerLength) {
        skip(skipped, lineNumber, 'column_mismatch', description);
        return null;
    }

    const cost = parseMoney(cells[columns.cost] ?? '');
    if (cost === null) {
        skip(skipped, lineNumber, 'invalid_cost', description);
        return null;
    }
    if (Math.abs(cost) < 0.0001) {
        skip(skipped, lineNumber, 'zero_cost', description);
        return null;
    }

    const currencyRaw = (cells[columns.currency] ?? '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyRaw)) {
        skip(skipped, lineNumber, 'invalid_currency', description);
        return null;
    }

    const expenseDate = parseSplitwiseDate(cells[columns.date] ?? '');
    if (!expenseDate) {
        skip(skipped, lineNumber, 'invalid_date', description);
        return null;
    }

    const impacts = parseMemberImpacts(cells, columns.members, lineNumber, description, skipped);
    if (!impacts) return null;

    const derived = deriveShares(cost, impacts);
    if (!derived) {
        skip(skipped, lineNumber, skipReasonForImpacts(impacts), description);
        return null;
    }

    return {
        lineNumber,
        expenseDate,
        description: description || category || 'Expense',
        category,
        amount: cost,
        currency: currencyRaw,
        payerMemberName: derived.payer,
        splits: derived.splits,
    };
}

export function parseSplitwiseCsvExport(csvText: string): SplitwiseParseResult {
    const rows = parseCsvText(csvText);
    if (rows.length === 0) {
        return { ok: false, error: 'empty_file' };
    }

    const header = rows[0].map((h) => h.trim());
    const columns = buildColumnMap(header);
    if (!columns) {
        const headerNorm = header.map(normalizeHeader);
        const hasRequired = REQUIRED.every((req) => headerNorm.includes(req));
        return { ok: false, error: hasRequired ? 'no_member_columns' : 'missing_required_columns' };
    }

    const expenses: SplitwiseParsedExpense[] = [];
    const skipped: SplitwiseSkippedRow[] = [];

    for (let r = 1; r < rows.length; r += 1) {
        const parsed = parseSplitwiseDataRow(rows[r], header.length, columns, r + 1, skipped);
        if (parsed) expenses.push(parsed);
    }

    return {
        ok: true,
        members: columns.members.map((c) => c.name),
        expenses,
        skipped,
        defaultCurrency: pickDefaultCurrency(expenses),
    };
}
