import type { AuthError } from '../services/auth.service';

export type EmailOtpClientErrorCode =
    | 'invalid_email'
    | 'invalid_otp'
    | 'rate_limited'
    | 'generic';

function messageFrom(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
        return String((err as { message: unknown }).message);
    }
    return String(err ?? 'Unknown error');
}

function statusFrom(err: unknown): number | undefined {
    if (typeof err === 'object' && err !== null && 'status' in err) {
        const status = (err as { status: unknown }).status;
        return typeof status === 'number' ? status : undefined;
    }
    return undefined;
}

function isRateLimited(message: string, status?: number): boolean {
    if (status === 429) return true;
    const lower = message.toLowerCase();
    return (
        lower.includes('rate limit')
        || lower.includes('once every')
        || lower.includes('too many requests')
        || lower.includes('email rate limit')
    );
}

function toDeletedAuthError(message: string): AuthError | null {
    const lower = message.toLowerCase();
    if (
        lower.includes('email_was_deleted')
        || lower.includes('user is banned')
        || lower.includes('banned_until')
        || lower.includes('account has been deleted')
    ) {
        return { code: 'account_deleted', message };
    }
    return null;
}

export function normalizeEmailInput(raw: string): string {
    return raw.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
    return EMAIL_RE.test(email);
}

export function mapEmailOtpSendError(err: unknown): AuthError {
    const message = messageFrom(err);
    const deleted = toDeletedAuthError(message);
    if (deleted) return deleted;
    if (isRateLimited(message, statusFrom(err))) {
        return { code: 'generic', message: 'email_otp_rate_limited' };
    }
    return { code: 'generic', message };
}

export function mapEmailOtpVerifyError(err: unknown): AuthError {
    const message = messageFrom(err);
    const deleted = toDeletedAuthError(message);
    if (deleted) return deleted;
    if (isRateLimited(message, statusFrom(err))) {
        return { code: 'generic', message: 'email_otp_rate_limited' };
    }
    const lower = message.toLowerCase();
    if (
        lower.includes('token has expired')
        || lower.includes('invalid otp')
        || lower.includes('otp_expired')
        || lower.includes('invalid token')
    ) {
        return { code: 'generic', message: 'email_otp_invalid' };
    }
    return { code: 'generic', message };
}
