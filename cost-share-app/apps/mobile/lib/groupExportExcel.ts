import * as XLSX from 'xlsx';
import type { Group, FeedItem, GroupMemberLite, PairwiseDebt } from '@cost-share/shared';
import { buildGroupExportCsv, type GroupExportInput } from './groupExportCsv';

export function buildGroupExportExcelBuffer(params: GroupExportInput): ArrayBuffer {
    const csv = buildGroupExportCsv(params);
    const rows = csv.split(/\r?\n/).filter(Boolean).map(line => line.split(','));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Trip');
    return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function buildGroupExportExcelBase64(params: GroupExportInput): string {
    const buf = buildGroupExportExcelBuffer(params);
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
}

export type { Group, FeedItem, GroupMemberLite, PairwiseDebt };
