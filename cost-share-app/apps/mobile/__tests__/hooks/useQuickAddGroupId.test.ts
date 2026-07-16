import {
    groupIdFromGroupsTabState,
    resolveQuickAddGroupId,
} from '../../hooks/useQuickAddGroupId';

describe('groupIdFromGroupsTabState', () => {
    it('reads groupId from focused GroupDetail', () => {
        expect(
            groupIdFromGroupsTabState({
                index: 1,
                routes: [
                    { key: 'a', name: 'GroupsList' },
                    {
                        key: 'b',
                        name: 'GroupDetail',
                        params: { groupId: 'g-viewing' },
                    },
                ],
            }),
        ).toBe('g-viewing');
    });

    it('reads groupId from a deeper screen under the group', () => {
        expect(
            groupIdFromGroupsTabState({
                index: 2,
                routes: [
                    { key: 'a', name: 'GroupsList' },
                    {
                        key: 'b',
                        name: 'GroupDetail',
                        params: { groupId: 'g-viewing' },
                    },
                    {
                        key: 'c',
                        name: 'Balances',
                        params: { groupId: 'g-viewing' },
                    },
                ],
            }),
        ).toBe('g-viewing');
    });
});

describe('resolveQuickAddGroupId', () => {
    const groups = [{ id: 'g-first' }, { id: 'g-second' }];

    it('prefers GroupDetail on the focused Groups tab', () => {
        expect(
            resolveQuickAddGroupId({
                favoriteGroupId: 'g-fav',
                groups,
                tabState: {
                    index: 3,
                    routes: [
                        { key: 'p', name: 'Profile' },
                        { key: 'a', name: 'Activity' },
                        { key: 'f', name: 'FavoriteGroup' },
                        {
                            key: 'g',
                            name: 'Groups',
                            state: {
                                index: 1,
                                routes: [
                                    { key: 'gl', name: 'GroupsList' },
                                    {
                                        key: 'gd',
                                        name: 'GroupDetail',
                                        params: { groupId: 'g-viewing' },
                                    },
                                ],
                            },
                        },
                    ],
                    routeNames: ['Profile', 'Activity', 'FavoriteGroup', 'Groups'],
                    type: 'tab',
                    key: 'tabs',
                    stale: false,
                },
            }),
        ).toBe('g-viewing');
    });

    it('uses favorite when FavoriteGroup tab is focused', () => {
        expect(
            resolveQuickAddGroupId({
                favoriteGroupId: 'g-fav',
                groups,
                tabState: {
                    index: 2,
                    routes: [
                        { key: 'p', name: 'Profile' },
                        { key: 'a', name: 'Activity' },
                        {
                            key: 'f',
                            name: 'FavoriteGroup',
                            state: {
                                index: 0,
                                routes: [
                                    {
                                        key: 'fh',
                                        name: 'FavoriteGroupHome',
                                        params: { groupId: 'g-fav' },
                                    },
                                ],
                            },
                        },
                        { key: 'g', name: 'Groups' },
                    ],
                    routeNames: ['Profile', 'Activity', 'FavoriteGroup', 'Groups'],
                    type: 'tab',
                    key: 'tabs',
                    stale: false,
                },
            }),
        ).toBe('g-fav');
    });

    it('falls back to favorite then first group', () => {
        expect(
            resolveQuickAddGroupId({
                favoriteGroupId: 'g-fav',
                groups,
                tabState: {
                    index: 0,
                    routes: [
                        { key: 'p', name: 'Profile' },
                        { key: 'a', name: 'Activity' },
                        { key: 'f', name: 'FavoriteGroup' },
                        { key: 'g', name: 'Groups' },
                    ],
                    routeNames: ['Profile', 'Activity', 'FavoriteGroup', 'Groups'],
                    type: 'tab',
                    key: 'tabs',
                    stale: false,
                },
            }),
        ).toBe('g-fav');

        expect(
            resolveQuickAddGroupId({
                favoriteGroupId: null,
                groups,
                tabState: undefined,
            }),
        ).toBe('g-first');
    });
});
