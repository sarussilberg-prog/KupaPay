/**
 * Minimal RFC 4180 CSV parser (UTF-8, optional BOM, CRLF or LF).
 */

const BOM = '\uFEFF';

export function stripCsvBom(text: string): string {
    return text.startsWith(BOM) ? text.slice(1) : text;
}

type CsvParseState = {
    rows: string[][];
    row: string[];
    field: string;
    inQuotes: boolean;
};

function flushField(state: CsvParseState): void {
    state.row.push(state.field);
    state.field = '';
}

function flushRow(state: CsvParseState): void {
    flushField(state);
    if (state.row.length > 1 || state.row[0] !== '') {
        state.rows.push(state.row);
    }
    state.row = [];
}

function stepCsvChar(state: CsvParseState, ch: string, next: string | undefined): number {
    if (state.inQuotes) {
        if (ch === '"') {
            if (next === '"') {
                state.field += '"';
                return 2;
            }
            state.inQuotes = false;
            return 1;
        }
        state.field += ch;
        return 1;
    }

    if (ch === '"') {
        state.inQuotes = true;
        return 1;
    }
    if (ch === ',') {
        flushField(state);
        return 1;
    }
    if (ch === '\n') {
        flushRow(state);
        return 1;
    }
    state.field += ch;
    return 1;
}

export function parseCsvText(text: string): string[][] {
    const normalized = stripCsvBom(text).replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    const state: CsvParseState = {
        rows: [],
        row: [],
        field: '',
        inQuotes: false,
    };

    let i = 0;
    while (i < normalized.length) {
        i += stepCsvChar(state, normalized[i], normalized[i + 1]);
    }

    flushRow(state);
    return state.rows;
}
