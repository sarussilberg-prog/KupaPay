/** Parse OCR / pasted receipt text into a draft expense (Pro receipt scan). */

export interface ReceiptDraft {
    amount: number | null;
    currency: string | null;
    expenseDate: string | null;
    merchant: string | null;
}

const CURRENCY_HINTS: Array<{ pattern: RegExp; code: string }> = [
    { pattern: /₪|ILS|NIS/i, code: 'ILS' },
    { pattern: /€|EUR/i, code: 'EUR' },
    { pattern: /\$|USD/i, code: 'USD' },
    { pattern: /GBP|£/i, code: 'GBP' },
];

const AMOUNT_RE = /(\d{1,6}[.,]\d{2})/g;
const DATE_RE = /(\d{4}-\d{2}-\d{2})|(\d{1,2}[./]\d{1,2}[./]\d{2,4})/;

function parseAmount(raw: string): number | null {
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
}

function normalizeDate(raw: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
    if (!m) return null;
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
}

export function parseReceiptDraftFromText(text: string): ReceiptDraft {
    const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
    const joined = lines.join(' ');

    let currency: string | null = null;
    for (const hint of CURRENCY_HINTS) {
        if (hint.pattern.test(joined)) {
            currency = hint.code;
            break;
        }
    }

    let amount: number | null = null;
    for (const match of joined.matchAll(AMOUNT_RE)) {
        const candidate = parseAmount(match[1]);
        if (candidate != null && (amount == null || candidate > amount)) {
            amount = candidate;
        }
    }

    let expenseDate: string | null = null;
    const dateMatch = joined.match(DATE_RE);
    if (dateMatch) {
        expenseDate = normalizeDate(dateMatch[0]);
    }

    const merchant =
        lines.find(line => !AMOUNT_RE.test(line) && !DATE_RE.test(line) && line.length > 2) ?? null;

    return { amount, currency, expenseDate, merchant };
}
