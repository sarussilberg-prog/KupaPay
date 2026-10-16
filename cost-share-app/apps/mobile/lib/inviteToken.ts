/** Matches 12–14 char invite tokens from generate_invite_token(). */
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{12,14}$/;

export function isValidInviteToken(token: string): boolean {
    return INVITE_TOKEN_RE.test(token);
}
