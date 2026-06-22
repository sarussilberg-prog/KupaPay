import type { TFunction } from 'i18next';

/**
 * Minimal user shape recognised by the display helpers.
 * Matches mobile's camelCase convention (post-mapper). All fields are tolerant
 * of `undefined` so callers from heterogeneous data sources (full User, lite
 * member rows, friend rows, current-user store) work uniformly.
 */
export type UserLike = {
    id: string;
    name?: string | null;
    avatarUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    isActive?: boolean;
} | null | undefined;

export function isDeleted(user: UserLike): boolean {
    return Boolean(user && user.isActive === false);
}

export function getDisplayName(user: UserLike, t: TFunction): string {
    // "Deleted user" is reserved for a POSITIVE deletion signal (isActive===false).
    // A missing profile only means we could not resolve who this is (offline, or a
    // former member outside the loaded roster) — label that neutrally, never as
    // "deleted", so we don't fabricate a deletion that didn't happen.
    if (user && user.isActive === false) return t('common.deletedUser');
    if (!user) return t('common.groupMember');
    return user.name?.trim() || t('common.unknownUser');
}

export function getAvatarUrl(user: UserLike): string | null {
    if (!user || user.isActive === false) return null;
    return user.avatarUrl ?? null;
}

/**
 * Resolve a debt counterparty's display name in the settle-up / balances list.
 * - current user                  → t('settleUp.you')
 * - resolved party (active/deleted) → their name from `nameById`
 * - id we could not resolve at all  → t('common.formerMember')
 *
 * The canonical simplifier emits a net for every user with financial footprint,
 * including members who left or deleted their account. The caller is responsible
 * for resolving those ids — including off-roster ones — into `nameById` via
 * `getDisplayNameForMember`, so a genuinely deleted account already arrives as
 * "Deleted user" here. An id STILL absent from `nameById` means we simply could
 * not resolve who it is (e.g. offline, or a profile we never fetched). Labelling
 * that "deleted user" would fabricate a deletion we cannot prove, so we use the
 * neutral "former member" — which still conveys "someone no longer in the group"
 * without hiding the debt or lying about why they're gone.
 */
export function resolveDebtPartyName(
    userId: string,
    currentUserId: string,
    nameById: Record<string, string>,
    t: TFunction,
): string {
    if (userId === currentUserId) return t('settleUp.you');
    return nameById[userId] ?? t('common.formerMember');
}

/** Returns contact email only for active users — never expose PII after deletion. */
export function getDisplayEmail(user: UserLike): string | undefined {
    if (!user || user.isActive === false) return undefined;
    return user.email?.trim() || undefined;
}

/** Returns phone only for active users — never expose PII after deletion. */
export function getDisplayPhone(user: UserLike): string | undefined {
    if (!user || user.isActive === false) return undefined;
    return user.phone?.trim() || undefined;
}

/** Display helpers for `GroupMemberLite` (shape: {userId, displayName, avatarUrl, isActive}). */
export interface MemberLike {
    userId: string;
    displayName: string;
    avatarUrl?: string;
    isActive: boolean;
}

export function getDisplayNameForMember(m: MemberLike | undefined | null, t: TFunction): string {
    if (!m) return t('common.groupMember');
    return getDisplayName({ id: m.userId, name: m.displayName, avatarUrl: m.avatarUrl, isActive: m.isActive }, t);
}

export function getAvatarUrlForMember(m: MemberLike | undefined | null): string | undefined {
    if (!m) return undefined;
    return getAvatarUrl({ id: m.userId, name: m.displayName, avatarUrl: m.avatarUrl, isActive: m.isActive }) ?? undefined;
}

/**
 * Display helpers for `FriendBalance` (shape: {userId, name, avatarUrl, isActive}).
 * `isActive` is required to mirror the strict `FriendBalance` type contract.
 */
export interface FriendLike {
    userId: string;
    name?: string | null;
    avatarUrl?: string | null;
    isActive: boolean;
}

export function getDisplayNameForFriend(f: FriendLike | undefined | null, t: TFunction): string {
    if (!f) return t('common.groupMember');
    return getDisplayName({ id: f.userId, name: f.name ?? null, avatarUrl: f.avatarUrl ?? null, isActive: f.isActive }, t);
}

export function getAvatarUrlForFriend(f: FriendLike | undefined | null): string | undefined {
    if (!f) return undefined;
    return getAvatarUrl({ id: f.userId, name: f.name ?? null, avatarUrl: f.avatarUrl ?? null, isActive: f.isActive }) ?? undefined;
}
