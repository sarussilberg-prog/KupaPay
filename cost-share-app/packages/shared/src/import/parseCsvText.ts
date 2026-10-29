/**
 * Minimal RFC 4180 CSV parser (UTF-8, optional BOM, CRLF or LF).
 */

const BOM = '\uFEFF';

export function stripCsvBom(text: string): string {
    return text.startsWith(BOM) ? text.slice(1) : text;
}

export function parseCsvText(text: string): string[][] {
    const normalized = stripCsvBom(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < normalized.length) {
        const ch = normalized[i];
        if (inQuotes) {
            if (ch === '"') {
                if (normalized[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }
        if (ch === ',') {
            row.push(field);
            field = '';
            i += 1;
            continue;
        }
        if (ch === '\n') {
            row.push(field);
            field = '';
            if (row.length > 1 || row[0] !== '') {
                rows.push(row);
            }
            row = [];
            i += 1;
            continue;
        }
        field += ch;
        i += 1;
    }

    row.push(field);
    if (row.length > 1 || row[0] !== '') {
        rows.push(row);
    }

    return rows;
}
