import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
    parseReceiptDraftFromText,
    type ReceiptDraft,
} from '../../../packages/shared/src/receiptOcr/parseReceiptDraftFromText.ts';

export interface ReceiptOcrEnv {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    RECEIPT_OCR_API_URL?: string;
    RECEIPT_OCR_API_KEY?: string;
}

export interface ReceiptOcrRequest {
    groupId: string;
    text?: string;
    imageBase64?: string;
}

const MAX_TEXT_LEN = 20_000;
const MAX_IMAGE_B64 = 2_800_000;
const MAX_CALLS_PER_USER_PER_DAY = 60;

const dailyCounts = new Map<string, { day: string; count: number }>();

function utcDay(): string {
    return new Date().toISOString().slice(0, 10);
}

export function checkRateLimit(userId: string): boolean {
    const day = utcDay();
    const row = dailyCounts.get(userId);
    if (!row || row.day !== day) {
        dailyCounts.set(userId, { day, count: 1 });
        return true;
    }
    if (row.count >= MAX_CALLS_PER_USER_PER_DAY) return false;
    row.count += 1;
    return true;
}

export function bearerJwt(req: Request): string | null {
    const h = req.headers.get('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m?.[1]?.trim() ?? null;
}

function authedClient(env: ReceiptOcrEnv, jwt: string): SupabaseClient {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/** Optional vendor OCR — only when RECEIPT_OCR_API_URL is configured. */
export async function fetchVendorReceiptText(
    env: ReceiptOcrEnv,
    imageBase64: string,
    fetchFn: typeof fetch = fetch,
): Promise<string | null> {
    const url = env.RECEIPT_OCR_API_URL?.trim();
    if (!url) return null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.RECEIPT_OCR_API_KEY) headers.Authorization = `Bearer ${env.RECEIPT_OCR_API_KEY}`;
    const res = await fetchFn(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string };
    return typeof body.text === 'string' ? body.text : null;
}

export type ReceiptOcrResult =
    | { ok: true; draft: ReceiptDraft; source: 'text' | 'vendor' | 'heuristic' }
    | { ok: false; error: string; code: string };

export async function handleReceiptOcr(
    req: ReceiptOcrRequest,
    env: ReceiptOcrEnv,
    jwt: string,
    fetchFn: typeof fetch = fetch,
): Promise<ReceiptOcrResult> {
    if (!req.groupId) return { ok: false, error: 'group_required', code: 'group_required' };

    const client = authedClient(env, jwt);
    const { data: userData, error: userErr } = await client.auth.getUser();
    if (userErr || !userData.user) {
        return { ok: false, error: 'unauthorized', code: 'unauthorized' };
    }
    const userId = userData.user.id;
    if (!checkRateLimit(userId)) {
        return { ok: false, error: 'rate_limited', code: 'rate_limited' };
    }

    const { data: hasPro, error: proErr } = await client.rpc('has_pro', {
        p_user_id: userId,
        p_group_id: req.groupId,
    });
    if (proErr || hasPro !== true) {
        return { ok: false, error: 'pro_required', code: 'pro_required' };
    }

    let text = (req.text ?? '').trim();
    let source: 'text' | 'vendor' | 'heuristic' = 'text';

    if (!text && req.imageBase64) {
        if (req.imageBase64.length > MAX_IMAGE_B64) {
            return { ok: false, error: 'payload_too_large', code: 'payload_too_large' };
        }
        const vendorText = await fetchVendorReceiptText(env, req.imageBase64, fetchFn);
        if (vendorText) {
            text = vendorText.trim();
            source = 'vendor';
        }
    }

    if (!text) {
        return { ok: false, error: 'text_required', code: 'text_required' };
    }
    if (text.length > MAX_TEXT_LEN) {
        return { ok: false, error: 'text_too_long', code: 'text_too_long' };
    }

    const draft = parseReceiptDraftFromText(text);
    if (source === 'text') source = 'heuristic';
    return { ok: true, draft, source };
}
