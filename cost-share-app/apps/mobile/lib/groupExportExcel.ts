import { buildGroupExportCsv, type GroupExportInput } from './groupExportCsv';

async function loadXlsx(): Promise<typeof import('xlsx')> {
    if (typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined) {
        // Jest (CJS): dynamic import('xlsx') needs VM modules; require keeps xlsx out of prod bundles.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('xlsx');
    }
    return import('xlsx');
}

export async function buildGroupExportExcelBuffer(params: GroupExportInput): Promise<ArrayBuffer> {
    const XLSX = await loadXlsx();
    const csv = buildGroupExportCsv(params);
    const rows = csv.split(/\r?\n/).filter(Boolean).map(line => line.split(','));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Trip');
    return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export async function buildGroupExportExcelBase64(params: GroupExportInput): Promise<string> {
    const buf = await buildGroupExportExcelBuffer(params);
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }
    return btoa(binary);
}
