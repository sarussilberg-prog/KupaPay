import { APP_WEB_ORIGIN } from '../brand';

/** Query param used on marketing / invite landing URLs. */
export const AMBASSADOR_REF_QUERY_PARAM = 'ref';

/** Cookie name set by the marketing web app (90-day attribution window). */
export const AMBASSADOR_REF_COOKIE = 'kupay_ambassador_ref';

const AMBASSADOR_CODE_RE = /^AMB-[A-Z0-9]{6,8}$/;

export function normalizeAmbassadorReferralCode(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const code = raw.trim().toUpperCase();
    return AMBASSADOR_CODE_RE.test(code) ? code : null;
}

export function parseAmbassadorRefFromSearchParams(
    params: URLSearchParams | Readonly<Record<string, string | undefined>>,
): string | null {
    const raw =
        params instanceof URLSearchParams
            ? params.get(AMBASSADOR_REF_QUERY_PARAM)
            : params[AMBASSADOR_REF_QUERY_PARAM];
    return normalizeAmbassadorReferralCode(raw);
}

export function parseAmbassadorRefFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parseAmbassadorRefFromSearchParams(parsed.searchParams);
    } catch {
        return null;
    }
}

/** Public link ambassadors share (locale landing + ?ref=). */
export function buildAmbassadorReferralUrl(code: string, locale = 'en'): string {
    const normalized = normalizeAmbassadorReferralCode(code);
    if (!normalized) {
        throw new Error('invalid_ambassador_referral_code');
    }
    const loc = locale.trim().toLowerCase();
    return `${APP_WEB_ORIGIN}/${loc}?${AMBASSADOR_REF_QUERY_PARAM}=${encodeURIComponent(normalized)}`;
}
