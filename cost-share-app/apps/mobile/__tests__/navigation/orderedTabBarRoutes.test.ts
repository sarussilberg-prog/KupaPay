import { orderedTabBarRoutes } from '../../navigation/orderedTabBarRoutes';

const ROUTES = [
    { name: 'Profile', key: 'p' },
    { name: 'Activity', key: 'a' },
    { name: 'FavoriteGroup', key: 'f' },
    { name: 'Groups', key: 'g' },
] as const;

describe('orderedTabBarRoutes (#699)', () => {
    it('keeps navigator order in LTR (en)', () => {
        expect(orderedTabBarRoutes(ROUTES, false).map((r) => r.name)).toEqual([
            'Profile',
            'Activity',
            'FavoriteGroup',
            'Groups',
        ]);
    });

    it.each(['he', 'ar'] as const)('swaps Profile and Activity in RTL (%s)', (locale) => {
        void locale;
        expect(orderedTabBarRoutes(ROUTES, true).map((r) => r.name)).toEqual([
            'Activity',
            'Profile',
            'FavoriteGroup',
            'Groups',
        ]);
    });
});
