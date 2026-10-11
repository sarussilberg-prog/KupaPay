import type { GroupExportInput } from './groupExportCsv';
import { buildGroupExportCsv } from './groupExportCsv';

function escapeHtml(s: string): string {
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function csvCellToHtml(cell: string): string {
    const unquoted = cell.replace(/^"|"$/g, '').replaceAll('""', '"');
    return `<td style="border:1px solid #ccc;padding:4px 8px;">${escapeHtml(unquoted)}</td>`;
}

export function buildGroupExportPdfHtml(params: GroupExportInput): string {
    const csv = buildGroupExportCsv(params);
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const body = lines
        .map(line => {
            const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.filter(Boolean) ?? [line];
            const rowHtml = cells.map(csvCellToHtml).join('');
            return `<tr>${rowHtml}</tr>`;
        })
        .join('');
    const title = escapeHtml(params.group.name);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title></head>
<body dir="${params.language === 'he' ? 'rtl' : 'ltr'}">
<h1>${title}</h1>
<table style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">${body}</table>
</body></html>`;
}

export async function printGroupExportPdf(params: GroupExportInput): Promise<string | null> {
    const Print = await import('expo-print');
    const html = buildGroupExportPdfHtml(params);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
}
