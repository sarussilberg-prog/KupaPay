/**
 * Group report export as a CSV file (UTF-8 BOM, RFC 4180, Excel-compatible).
 */

import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { captureError } from '../lib/captureError';
import { Group, FeedItem, GroupMemberLite, PairwiseDebt } from '@cost-share/shared';
import i18n from '../i18n';
import { buildGroupExportCsv } from '../lib/groupExportCsv';
import { buildGroupExportExcelBase64 } from '../lib/groupExportExcel';
import { printGroupExportPdf } from '../lib/groupExportPdf';
import { downloadTextAsFile } from '../lib/webFileDownload';
import { showErrorToast, showSuccessMessage } from '../lib/appToast';

export interface GroupExportPayload {
    feed: FeedItem[];
    debts: PairwiseDebt[];
    members: GroupMemberLite[];
}


/** Filesystem-safe export basename that keeps the group name (incl. Hebrew). */
export function buildGroupExportFilename(group: Group, exportedAt = new Date()): string {
    const trimmed = group.name.trim();
    const base =
        trimmed
            .replace(/[/\\:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 60) || 'group';
    return `${base}-${todayIsoFrom(exportedAt)}.csv`;
}

function todayIsoFrom(date: Date): string {
    return date.toISOString().slice(0, 10);
}

async function writeCsvReport(group: Group, csv: string): Promise<string> {
    const filename = buildGroupExportFilename(group);
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(csv);
    return file.uri;
}

function buildExportInput(group: Group, payload: GroupExportPayload) {
    const language = i18n.language === 'he' ? 'he' : 'en';
    return {
        group,
        feed: payload.feed,
        debts: payload.debts,
        members: payload.members,
        exportedAt: new Date(),
        language,
        t: i18n.t.bind(i18n),
    } as const;
}

export async function exportGroupCsv(
    group: Group,
    payload: GroupExportPayload,
): Promise<boolean> {
    try {
        const csv = buildGroupExportCsv(buildExportInput(group, payload));

        if (Platform.OS === 'web') {
            downloadTextAsFile(buildGroupExportFilename(group), csv, 'text/csv;charset=utf-8');
            showSuccessMessage('groups.share.exportDownloaded');
            return true;
        }

        const uri = await writeCsvReport(group, csv);

        const Sharing = await import('expo-sharing');
        const available = await Sharing.isAvailableAsync();
        if (!available) {
            showErrorToast('groups.share.exportError');
            return false;
        }
        await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: i18n.t('groups.share.exportTitle'),
            UTI: 'public.comma-separated-values-text',
        });
        return true;
    } catch (error) {
        captureError(error, {
            tags: { service: 'group-share', op: 'export' },
        });
        console.error('Failed to export group report:', error);
        showErrorToast('groups.share.exportError', 'common.retry');
        return false;
    }
}

function xlsxFilename(group: Group, exportedAt = new Date()): string {
    return buildGroupExportFilename(group, exportedAt).replace(/\.csv$/i, '.xlsx');
}

function pdfFilename(group: Group, exportedAt = new Date()): string {
    return buildGroupExportFilename(group, exportedAt).replace(/\.csv$/i, '.pdf');
}

export async function exportGroupExcel(
    group: Group,
    payload: GroupExportPayload,
): Promise<boolean> {
    try {
        const input = buildExportInput(group, payload);
        const filename = xlsxFilename(group);
        const base64 = buildGroupExportExcelBase64(input);

        if (Platform.OS === 'web') {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            let i = 0;
            for (const ch of binary) {
                bytes[i] = ch.codePointAt(0) ?? 0;
                i += 1;
            }
            const blob = new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showSuccessMessage('groups.share.exportDownloaded');
            return true;
        }

        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        file.write(base64, { encoding: 'base64' });

        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) {
            showErrorToast('groups.share.exportError');
            return false;
        }
        await Sharing.shareAsync(file.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: i18n.t('groups.share.exportTitle'),
        });
        return true;
    } catch (error) {
        captureError(error, { tags: { service: 'group-share', op: 'exportExcel' } });
        showErrorToast('groups.share.exportError', 'common.retry');
        return false;
    }
}

export async function exportGroupPdf(
    group: Group,
    payload: GroupExportPayload,
): Promise<boolean> {
    try {
        const input = buildExportInput(group, payload);
        const uri = await printGroupExportPdf(input);
        if (!uri) {
            showErrorToast('groups.share.exportError');
            return false;
        }

        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) {
            showErrorToast('groups.share.exportError');
            return false;
        }
        await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: i18n.t('groups.share.exportTitle'),
            UTI: 'com.adobe.pdf',
        });
        return true;
    } catch (error) {
        captureError(error, { tags: { service: 'group-share', op: 'exportPdf' } });
        showErrorToast('groups.share.exportError', 'common.retry');
        return false;
    }
}
