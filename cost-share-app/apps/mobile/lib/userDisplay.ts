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
    if (!user || user.isActive === false) return t('common.deletedUser');
    return user.name?.trim() || t('common.unknownUser');
}

export function getAvatarUrl(user: UserLike): string | null {
    if (!user || user.isActive === false) return null;
    return user.avatarUrl ?? null;
}

/**
 * Resolve a debt counterparty's display name in the settle-up / balances list.
 * - current user            → t('settleUp.you')
 * - known active member      → their roster name
 * - id absent from the roster → t('common.deletedUser')
 *
 * The canonical simplifier emits a net for every user with financial footprint,
 * including members who left or deleted their account. Those ids are NOT in the
 * active-member roster, so the only correct label for them is "deleted user" —
 * never the generic "unknown", which would hide that a real debt is owed
 * to/from someone no longer in the group.
 */
export function resolveDebtPartyName(
    userId: string,
    currentUserId: string,
    nameById: Record<string, string>,
    t: TFunction,
): string {
    if (userId === currentUserId) return t('settleUp.you');
    return nameById[userId] ?? t('common.deletedUser');
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
    if (!m) return t('common.deletedUser');
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
    if (!f) return t('common.deletedUser');
    return getDisplayName({ id: f.userId, name: f.name ?? null, avatarUrl: f.avatarUrl ?? null, isActive: f.isActive }, t);
}

export function getAvatarUrlForFriend(f: FriendLike | undefined | null): string | undefined {
    if (!f) return undefined;
    return getAvatarUrl({ id: f.userId, name: f.name ?? null, avatarUrl: f.avatarUrl ?? null, isActive: f.isActive }) ?? undefined;
}
