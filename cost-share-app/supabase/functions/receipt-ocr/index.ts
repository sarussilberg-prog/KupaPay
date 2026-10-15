import { handleReceiptOcr } from './handler.ts';

const API_URL = Deno.env.get('RECEIPT_OCR_API_URL') ?? '';
const API_KEY = Deno.env.get('RECEIPT_OCR_API_KEY') ?? '';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405 });
    }

    let body: { text?: string; imageBase64?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), { status: 400 });
    }

    const result = await handleReceiptOcr(body, {
        async ocrTextFromImage(imageBase64) {
            if (!API_URL || !API_KEY) return null;
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${API_KEY}`,
                },
                body: JSON.stringify({ imageBase64 }),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { text?: string };
            return data.text ?? null;
        },
    });

    return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
    });
});
