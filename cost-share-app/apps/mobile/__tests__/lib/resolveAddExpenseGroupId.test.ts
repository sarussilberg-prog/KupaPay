import {
    isKnownGroupId,
    resolveAddExpenseGroupId,
} from '../../lib/favoriteGroup';
import type { GroupWithMembers } from '@cost-share/shared';

function makeGroup(id: string): GroupWithMembers {
    return {
        id,
        name: id,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date('2026-03-01'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

const groups = [makeGroup('g-new'), makeGroup('g-old')];

describe('isKnownGroupId', () => {
    it('returns true only for ids present in the list', () => {
        expect(isKnownGroupId('g-new', groups)).toBe(true);
        expect(isKnownGroupId('missing', groups)).toBe(false);
        expect(isKnownGroupId(undefined, groups)).toBe(false);
    });
});

describe('resolveAddExpenseGroupId', () => {
    it('prefers a valid route group id', () => {
        expect(
            resolveAddExpenseGroupId({
                routeGroupId: 'g-old',
                favoriteGroupId: 'g-new',
                groups,
            }),
        ).toBe('g-old');
    });

    it('ignores a stale route id and falls back to effective favorite', () => {
        expect(
            resolveAddExpenseGroupId({
                routeGroupId: 'deleted',
                favoriteGroupId: 'g-new',
                groups,
            }),
        ).toBe('g-new');
    });

    it('returns undefined when there are no groups', () => {
        expect(
            resolveAddExpenseGroupId({
                routeGroupId: 'g-old',
                favoriteGroupId: 'g-old',
                groups: [],
            }),
        ).toBeUndefined();
    });
});
