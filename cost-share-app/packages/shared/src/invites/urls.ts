import { APP_WEB_ORIGIN } from '../brand';

export type InviteLinkKind = 'friend' | 'group';

/** Universal Links / App Links host — production web origin, not dev preview URLs. */
export function buildInviteUrl(kind: InviteLinkKind, token: string): string {
    const prefix = kind === 'friend' ? '/i/' : '/g/';
    return `${APP_WEB_ORIGIN}${prefix}${token}`;
}

/** Settle-up reminder share link (`/sr/<group invite token>`). */
export function buildSettleReminderUrl(token: string): string {
    return `${APP_WEB_ORIGIN}/sr/${token}`;
}

/** Public read-only balance page (`/b/<public_balance_token>` — not a join link). */
export function buildPublicGroupBalanceUrl(publicBalanceToken: string): string {
    return `${APP_WEB_ORIGIN}/b/${publicBalanceToken}`;
}

/** Single-expense share preview for non-members (#401). */
export function buildExpenseShareUrl(shareToken: string): string {
    return `${APP_WEB_ORIGIN}/e/${shareToken}`;
}
