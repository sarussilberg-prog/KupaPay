import { parseReceiptDraftFromText, type ReceiptDraft } from '@cost-share/shared';
import { supabase } from '../lib/supabase';

export type { ReceiptDraft };

/** On-device heuristic ($0). */
export function parseReceiptLocally(text: string): ReceiptDraft {
    return parseReceiptDraftFromText(text);
}

/** Optional server path (same heuristic unless RECEIPT_OCR_API_URL is set). */
export async function parseReceiptViaEdge(
    groupId: string,
    text: string,
): Promise<ReceiptDraft | null> {
    const { data, error } = await supabase.functions.invoke('receipt-ocr', {
        body: { groupId, text },
    });
    if (error || !data?.ok) return null;
    return (data as { draft: ReceiptDraft }).draft;
}
