import {
    confirmSetFavoriteGroup,
    isGroupFavorite,
    type ConfirmSetFavoriteDeps,
} from '../../lib/favoriteGroupMenu';
import type { PlatformAlertButton } from '../../lib/platformAlert';

// t() echoes the key with interpolation params appended so we can assert on both.
const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;

function makeDeps(
    overrides: Partial<ConfirmSetFavoriteDeps> = {},
): {
    deps: ConfirmSetFavoriteDeps;
    alert: jest.Mock;
    setFavoriteGroupId: jest.Mock;
    onApplied: jest.Mock;
} {
    const alert = jest.fn();
    const setFavoriteGroupId = jest.fn();
    const onApplied = jest.fn();
    const deps: ConfirmSetFavoriteDeps = {
        groupId: 'g1',
        groupName: 'Trip to the beach',
        favoriteGroupId: null,
        t,
        alert,
        setFavoriteGroupId,
        onApplied,
        ...overrides,
    };
    return { deps, alert, setFavoriteGroupId, onApplied };
}

/** Pull a specific button out of the alert() call by its style. */
function buttonByStyle(
    alert: jest.Mock,
    style: PlatformAlertButton['style'],
): PlatformAlertButton {
    const buttons = alert.mock.calls[0][2] as PlatformAlertButton[];
    const match = buttons.find((b) => b.style === style);
    if (!match) throw new Error(`no button with style ${style}`);
    return match;
}

describe('isGroupFavorite', () => {
    it('is true only when the ids match', () => {
        expect(isGroupFavorite('g1', 'g1')).toBe(true);
        expect(isGroupFavorite('g1', 'g2')).toBe(false);
        expect(isGroupFavorite('g1', null)).toBe(false);
    });
});

describe('confirmSetFavoriteGroup', () => {
    it('shows a confirmation with the group name interpolated', () => {
        const { deps, alert } = makeDeps();

        confirmSetFavoriteGroup(deps);

        expect(alert).toHaveBeenCalledTimes(1);
        const [title, message] = alert.mock.calls[0];
        expect(title).toBe('groups.favorite.confirmTitle');
        expect(message).toBe(
            'groups.favorite.confirmMessage:{"name":"Trip to the beach"}',
        );
    });

    it('applies the favorite only after the confirm button is pressed', () => {
        const { deps, alert, setFavoriteGroupId, onApplied } = makeDeps();

        confirmSetFavoriteGroup(deps);
        // Nothing happens until the user confirms.
        expect(setFavoriteGroupId).not.toHaveBeenCalled();

        buttonByStyle(alert, 'default').onPress?.();

        expect(setFavoriteGroupId).toHaveBeenCalledTimes(1);
        expect(setFavoriteGroupId).toHaveBeenCalledWith('g1');
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('does not apply the favorite when the user cancels', () => {
        const { deps, alert, setFavoriteGroupId, onApplied } = makeDeps();

        confirmSetFavoriteGroup(deps);
        buttonByStyle(alert, 'cancel').onPress?.();

        expect(setFavoriteGroupId).not.toHaveBeenCalled();
        expect(onApplied).not.toHaveBeenCalled();
    });

    it('is a no-op when the group is already the favorite', () => {
        const { deps, alert, setFavoriteGroupId } = makeDeps({
            favoriteGroupId: 'g1',
        });

        confirmSetFavoriteGroup(deps);

        expect(alert).not.toHaveBeenCalled();
        expect(setFavoriteGroupId).not.toHaveBeenCalled();
    });
});
