import type { TFunction } from 'i18next';

export type UserLike = {
    id: string;
    name: string | null;
    avatar_url: string | null;
    is_active: boolean;
} | null | undefined;

export function isDeleted(user: UserLike): boolean {
    return Boolean(user && user.is_active === false);
}

export function getDisplayName(user: UserLike, t: TFunction): string {
    if (!user || user.is_active === false) return t('common.deletedUser');
    return user.name?.trim() || t('common.unknownUser');
}

export function getAvatarUrl(user: UserLike): string | null {
    if (!user || user.is_active === false) return null;
    return user.avatar_url;
}
