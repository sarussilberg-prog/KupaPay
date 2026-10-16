/** Prefix for clipboard payloads written by the invite landing page (first-launch iOS fallback). */
export const DEFERRED_INVITE_CLIPBOARD_PREFIX = 'kupapay-deferred-invite-v1';

/** Play Install Referrer query keys (Android store → first launch). */
export const DEFERRED_INVITE_REFERRER_KIND_KEY = 'invite_kind';
export const DEFERRED_INVITE_REFERRER_TOKEN_KEY = 'invite_token';

/** Matches 12–14 char invite tokens from generate_invite_token(). */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{12,14}$/;

export type DeferredInviteKind = 'friend' | 'group';

export type DeferredInvitePayload = {
    kind: DeferredInviteKind;
    token: string;
};

/** Path segment for friend / group invites (settle reminders use `sr` but are not deferred). */
export type InvitePathKind = 'i' | 'g' | 'sr';
