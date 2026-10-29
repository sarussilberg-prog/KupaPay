import {
    AMBASSADOR_REF_COOKIE,
    AMBASSADOR_REF_QUERY_PARAM,
    normalizeAmbassadorReferralCode,
} from '@cost-share/shared';

/** 90-day attribution window for ?ref= ambassador codes. */
export const AMBASSADOR_REF_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

export function ambassadorRefFromRequestUrl(url: URL): string | null {
    return normalizeAmbassadorReferralCode(url.searchParams.get(AMBASSADOR_REF_QUERY_PARAM));
}

export function applyAmbassadorRefCookie(
    response: { cookies: { set: (name: string, value: string, opts: { path: string; maxAge: number; sameSite: 'lax' }) => void } },
    code: string,
): void {
    response.cookies.set(AMBASSADOR_REF_COOKIE, code, {
        path: '/',
        maxAge: AMBASSADOR_REF_COOKIE_MAX_AGE,
        sameSite: 'lax',
    });
}

export { AMBASSADOR_REF_COOKIE, AMBASSADOR_REF_QUERY_PARAM };
