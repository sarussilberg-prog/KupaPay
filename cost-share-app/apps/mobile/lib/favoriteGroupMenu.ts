/**
 * Confirm-then-set flow for marking a group as the user's favorite from the
 * group menu. Extracted from GroupDetailScreen so the confirm/cancel branching
 * and the "already favorite" guard can be unit-tested without mounting the
 * heavy screen (realtime hooks + many queries).
 *
 * Both this menu action and the FavoriteGroupSwitcher write the same
 * `favoriteGroupId` in the Zustand store — this is an additional entry point,
 * not a replacement.
 */

import type { PlatformAlertButton } from './platformAlert';

export interface ConfirmSetFavoriteDeps {
    groupId: string;
    groupName: string;
    /** The currently-favorite group id (null when none is set). */
    favoriteGroupId: string | null;
    /** i18n translator; receives a key + optional interpolation params. */
    t: (key: string, params?: Record<string, unknown>) => string;
    /** platformAlert (title, message, buttons). */
    alert: (
        title: string,
        message: string | undefined,
        buttons: PlatformAlertButton[],
    ) => void;
    /** Store setter. */
    setFavoriteGroupId: (id: string) => void;
    /** Optional single-line success feedback shown after applying. */
    onApplied?: () => void;
}

/**
 * Returns true when this group is already the favorite (caller may reflect that
 * in the menu row as a disabled "current favorite" label).
 */
export function isGroupFavorite(
    groupId: string,
    favoriteGroupId: string | null,
): boolean {
    return favoriteGroupId === groupId;
}

/**
 * Show the "make this your favorite?" confirmation. On confirm, writes the
 * favorite group id and (optionally) fires success feedback. No-op when the
 * group is already the favorite.
 */
export function confirmSetFavoriteGroup(deps: ConfirmSetFavoriteDeps): void {
    const { groupId, groupName, favoriteGroupId, t, alert, setFavoriteGroupId, onApplied } = deps;

    if (isGroupFavorite(groupId, favoriteGroupId)) return;

    alert(
        t('groups.favorite.confirmTitle'),
        t('groups.favorite.confirmMessage', { name: groupName }),
        [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('groups.favorite.confirmCta'),
                style: 'default',
                onPress: () => {
                    setFavoriteGroupId(groupId);
                    onApplied?.();
                },
            },
        ],
    );
}
