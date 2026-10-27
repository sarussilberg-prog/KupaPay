/** Resend-backed transactional email (#404). Requires RESEND_API_KEY; otherwise no-op. */

export interface SendTransactionalEmailInput {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export type SendTransactionalEmailResult =
    | { ok: true; provider: 'resend'; id?: string }
    | { ok: false; skipped: true; reason: 'provider_disabled' | 'missing_api_key' }
    | { ok: false; error: string };

export function transactionalEmailEnabled(): boolean {
    if (Deno.env.get('TRANSACTIONAL_EMAIL_ENABLED') === 'false') return false;
    return Boolean(Deno.env.get('RESEND_API_KEY')?.trim());
}

export async function sendTransactionalEmail(
    input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
    if (Deno.env.get('TRANSACTIONAL_EMAIL_ENABLED') === 'false') {
        return { ok: false, skipped: true, reason: 'provider_disabled' };
    }
    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
    if (!apiKey) {
        return { ok: false, skipped: true, reason: 'missing_api_key' };
    }
    const from = input.from ?? Deno.env.get('TRANSACTIONAL_EMAIL_FROM') ?? 'KupaPay <noreply@kupa-pay.com>';
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `resend_${res.status}:${text.slice(0, 200)}` };
    }
    const body = await res.json().catch(() => ({})) as { id?: string };
    return { ok: true, provider: 'resend', id: body.id };
}
