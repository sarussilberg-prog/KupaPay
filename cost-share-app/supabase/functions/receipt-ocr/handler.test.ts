import { handleReceiptOcr } from './handler.ts';

Deno.test('parses text input without external OCR', async () => {
    const res = await handleReceiptOcr({
        text: 'Store\n2026-01-02\nTotal USD 12.34',
    });
    if (!res.ok || res.draft?.amount !== 12.34 || res.draft.currency !== 'USD') {
        throw new Error(JSON.stringify(res));
    }
});

Deno.test('image without provider returns not configured', async () => {
    const res = await handleReceiptOcr({ imageBase64: 'abc' });
    if (res.configured || res.error !== 'ocr_not_configured') {
        throw new Error(JSON.stringify(res));
    }
});
