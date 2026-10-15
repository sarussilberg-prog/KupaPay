import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { ReceiptDraft } from '../lib/receiptDraftFromText';
import { parseReceiptDraftFromText } from '../lib/receiptDraftFromText';

export interface ReceiptScanResult {
    draft: ReceiptDraft | null;
    configured: boolean;
    localUri: string;
}

export async function scanReceiptImage(localUri: string): Promise<ReceiptScanResult> {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
    });

    const { data, error } = await supabase.functions.invoke('receipt-ocr', {
        body: { imageBase64: base64 },
    });

    if (error || !data) {
        return {
            draft: null,
            configured: false,
            localUri,
        };
    }

    const payload = data as {
        ok?: boolean;
        configured?: boolean;
        draft?: ReceiptDraft | null;
        text?: string;
    };

    if (payload.draft) {
        return { draft: payload.draft, configured: payload.configured === true, localUri };
    }

    if (payload.text) {
        return {
            draft: parseReceiptDraftFromText(payload.text),
            configured: true,
            localUri,
        };
    }

    return { draft: null, configured: payload.configured === true, localUri };
}
