import { INVITE_TOKEN_RE, type DeferredInviteKind, type InvitePathKind } from './constants';

export type ParsedInvitePath =
    | { pathKind: InvitePathKind; kind: DeferredInviteKind; token: string }
    | { pathKind: 'sr'; token: string }
    | null;

/**
 * Parse `/i|g|sr/<token>` from a URL pathname (leading slash optional).
 */
export function parseInvitePathFromPathname(pathname: string): ParsedInvitePath {
    const m = pathname.match(/^\/?(i|g|sr)\/([^/?#]+)\/?$/);
    if (!m || !INVITE_TOKEN_RE.test(m[2])) return null;
    const pathKind = m[1] as InvitePathKind;
    if (pathKind === 'i') return { pathKind, kind: 'friend', token: m[2] };
    if (pathKind === 'g') return { pathKind, kind: 'group', token: m[2] };
    return { pathKind: 'sr', token: m[2] };
}

export function toDeferredInvitePayload(
    parsed: ParsedInvitePath,
): { kind: DeferredInviteKind; token: string } | null {
    if (!parsed || parsed.pathKind === 'sr') return null;
    return { kind: parsed.kind, token: parsed.token };
}
