import {
    DEFERRED_INVITE_REFERRER_KIND_KEY,
    DEFERRED_INVITE_REFERRER_TOKEN_KEY,
    INVITE_TOKEN_RE,
    type DeferredInviteKind,
    type DeferredInvitePayload,
} from './constants';

export function encodePlayInstallReferrer(payload: DeferredInvitePayload): string {
    const params = new URLSearchParams({
        [DEFERRED_INVITE_REFERRER_KIND_KEY]: payload.kind,
        [DEFERRED_INVITE_REFERRER_TOKEN_KEY]: payload.token,
    });
    return params.toString();
}

export function parsePlayInstallReferrer(raw: string | null | undefined): DeferredInvitePayload | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let params: URLSearchParams;
    try {
        params = new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed);
    } catch {
        return null;
    }

    const kind = params.get(DEFERRED_INVITE_REFERRER_KIND_KEY);
    const token = params.get(DEFERRED_INVITE_REFERRER_TOKEN_KEY);
    if ((kind !== 'friend' && kind !== 'group') || !token || !INVITE_TOKEN_RE.test(token)) {
        return null;
    }
    return { kind: kind as DeferredInviteKind, token };
}
