/**
 * Receipt OCR edge handler.
 * Optional paid provider: set RECEIPT_OCR_API_URL + RECEIPT_OCR_API_KEY (see docs/RECEIPT_OCR.md).
 * Without keys, accepts `text` for parsing only (client/on-device OCR can POST text).
 */

import { parseReceiptDraftFromText, type ReceiptDraft } from './parse.ts';

export interface ReceiptOcrRequest {
    text?: string;
    imageBase64?: string;
}

export interface ReceiptOcrResponse {
    ok: boolean;
    configured: boolean;
    draft: ReceiptDraft | null;
    error?: string;
}

export interface ReceiptOcrDeps {
    ocrTextFromImage?(imageBase64: string): Promise<string | null>;
}

export async function handleReceiptOcr(
    body: ReceiptOcrRequest,
    deps: ReceiptOcrDeps = {},
): Promise<ReceiptOcrResponse> {
    if (body.text?.trim()) {
        return {
            ok: true,
            configured: true,
            draft: parseReceiptDraftFromText(body.text),
        };
    }

    if (body.imageBase64 && deps.ocrTextFromImage) {
        const text = await deps.ocrTextFromImage(body.imageBase64);
        if (text?.trim()) {
            return {
                ok: true,
                configured: true,
                draft: parseReceiptDraftFromText(text),
            };
        }
    }

    if (body.imageBase64) {
        return {
            ok: false,
            configured: false,
            draft: null,
            error: 'ocr_not_configured',
        };
    }

    return { ok: false, configured: false, draft: null, error: 'missing_input' };
}
