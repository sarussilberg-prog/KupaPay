export type ReceiptDraft = {
    amount?: number;
    currency?: string;
    expenseDate?: string;
    merchant?: string;
    confidence: 'low' | 'medium';
};

const CURRENCY_HINTS: Record<string, string> = {
    '₪': 'ILS',
    ILS: 'ILS',
    NIS: 'ILS',
    '$': 'USD',
    USD: 'USD',
    '€': 'EUR',
    EUR: 'EUR',
    GBP: 'GBP',
    '£': 'GBP',
};

const TOTAL_LINE = /\b(total|amount due|balance due|grand total|סה[״\"']?כ|לתשלום)\b/i;

function parseAmountToken(raw: string): number | undefined {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function findAmount(lines: string[]): number | undefined {
    let best: number | undefined;
    for (const line of lines) {
        if (TOTAL_LINE.test(line)) {
            const match = line.match(/(\d[\d.,]*)/);
            const v = match ? parseAmountToken(match[1]) : undefined;
            if (v !== undefined) return v;
        }
    }
    for (const line of lines) {
        const matches = line.match(/\d[\d.,]{1,12}/g);
        if (!matches) continue;
        for (const m of matches) {
            const v = parseAmountToken(m);
            if (v !== undefined && (best === undefined || v > best)) best = v;
        }
    }
    return best;
}

function findCurrency(text: string): string | undefined {
    for (const [hint, code] of Object.entries(CURRENCY_HINTS)) {
        if (text.includes(hint)) return code;
    }
    const iso = text.match(/\b([A-Z]{3})\b/);
    if (iso && CURRENCY_HINTS[iso[1]]) return iso[1];
    return undefined;
}

function findDate(text: string): string | undefined {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    if (dmy) {
        const dd = dmy[1].padStart(2, '0');
        const mm = dmy[2].padStart(2, '0');
        return `${dmy[3]}-${mm}-${dd}`;
    }
    return undefined;
}

function findMerchant(lines: string[]): string | undefined {
    for (const line of lines) {
        const t = line.trim();
        if (t.length < 2) continue;
        if (/^\d/.test(t)) continue;
        if (TOTAL_LINE.test(t)) continue;
        return t.slice(0, 120);
    }
    return undefined;
}

/** Heuristic receipt parser — no external API. */
export function parseReceiptDraftFromText(rawText: string): ReceiptDraft {
    const text = rawText.replace(/\r\n/g, '\n').trim();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const amount = findAmount(lines);
    const currency = findCurrency(text);
    const expenseDate = findDate(text);
    const merchant = findMerchant(lines);
    const confidence =
        amount !== undefined && (currency !== undefined || merchant !== undefined)
            ? 'medium'
            : 'low';
    return { amount, currency, expenseDate, merchant, confidence };
}
