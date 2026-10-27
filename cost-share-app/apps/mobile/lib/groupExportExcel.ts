import { buildGroupExportCsv, type GroupExportInput } from './groupExportCsv';

async function loadXlsx() {
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
