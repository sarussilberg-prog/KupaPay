import { orderedTabBarRoutes } from '../../navigation/orderedTabBarRoutes';

const ROUTES = [
    { name: 'Profile', key: 'p' },
    { name: 'Activity', key: 'a' },
    { name: 'FavoriteGroup', key: 'f' },
    { name: 'Groups', key: 'g' },
] as const;

describe('orderedTabBarRoutes', () => {
    it('keeps navigator order in LTR (en)', () => {
        expect(orderedTabBarRoutes(ROUTES, false).map((r) => r.name)).toEqual([
            'Profile',
            'Activity',
            'FavoriteGroup',
            'Groups',
        ]);
    });

    it.each(['he', 'ar'] as const)(
        'keeps the same visual order in RTL (%s) — tab bar uses explicit LTR flex',
        (locale) => {
            void locale;
            expect(orderedTabBarRoutes(ROUTES, true).map((r) => r.name)).toEqual([
                'Profile',
                'Activity',
                'FavoriteGroup',
                'Groups',
            ]);
        },
    );
});
