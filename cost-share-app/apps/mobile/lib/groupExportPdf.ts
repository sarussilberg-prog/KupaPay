import type { GroupExportInput } from './groupExportCsv';
import { buildGroupExportCsv } from './groupExportCsv';

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildGroupExportPdfHtml(params: GroupExportInput): string {
    const csv = buildGroupExportCsv(params);
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const rows = lines.map(line => {
        const cells = line.match(/("([^"]|"")*"|[^,]*)/g)?.filter(Boolean) ?? [line];
        return cells.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
    });
    const body = rows
        .map(
            row =>
                `<tr>${row.map(c => `<td style="border:1px solid #ccc;padding:4px 8px;">${escapeHtml(c)}</td>`).join('')}</tr>`,
        )
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
