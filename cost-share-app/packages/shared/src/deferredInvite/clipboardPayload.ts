import {
    DEFERRED_INVITE_CLIPBOARD_PREFIX,
    type DeferredInviteKind,
    type DeferredInvitePayload,
} from './constants';

export function formatDeferredInviteClipboard(payload: DeferredInvitePayload): string {
    return `${DEFERRED_INVITE_CLIPBOARD_PREFIX}:${payload.kind}:${payload.token}`;
}

export function parseDeferredInviteClipboard(text: string | null | undefined): DeferredInvitePayload | null {
    if (!text) return null;
    const trimmed = text.trim();
    const prefix = `${DEFERRED_INVITE_CLIPBOARD_PREFIX}:`;
    if (!trimmed.startsWith(prefix)) return null;
    const rest = trimmed.slice(prefix.length);
    const sep = rest.indexOf(':');
    if (sep <= 0) return null;
    const kind = rest.slice(0, sep);
    const token = rest.slice(sep + 1);
    if (kind !== 'friend' && kind !== 'group') return null;
    return { kind: kind as DeferredInviteKind, token };
}
