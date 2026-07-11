import { resolveFavoriteGroupId } from '../../lib/favoriteGroup';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(
    id: string,
    updatedAt: string,
    overrides: Partial<GroupWithMembers> = {},
): GroupWithMembers {
    return {
        id,
        name: `Group ${id}`,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date(updatedAt),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
        ...overrides,
    } as unknown as GroupWithMembers;
}

describe('resolveFavoriteGroupId', () => {
    const older = makeGroup('a', '2026-01-01T00:00:00Z');
    const newer = makeGroup('b', '2026-03-01T00:00:00Z');
    const groups = [older, newer];

    it('returns null when there are no groups', () => {
        expect(resolveFavoriteGroupId('anything', [])).toBeNull();
        expect(resolveFavoriteGroupId(null, [])).toBeNull();
    });

    it('falls back to the first group (newest updatedAt, same order as the list) when stored id is null', () => {
        expect(resolveFavoriteGroupId(null, groups)).toBe('b');
    });

    it('falls back to the first group when stored id is not in the list (deleted / left)', () => {
        expect(resolveFavoriteGroupId('gone', groups)).toBe('b');
    });

    it('honors a valid stored id even when it is not the first group', () => {
        expect(resolveFavoriteGroupId('a', groups)).toBe('a');
    });

    it('never returns an archived group as the fallback; prefers an active one', () => {
        const archivedNewest = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        // c is newest but archived → fallback should skip it and pick active b.
        expect(resolveFavoriteGroupId(null, [older, newer, archivedNewest])).toBe('b');
    });

    it('honors a valid stored id even if that group is archived', () => {
        const archived = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        expect(resolveFavoriteGroupId('c', [older, newer, archived])).toBe('c');
    });

    it('falls back to an archived group only when it is the sole option', () => {
        const onlyArchived = makeGroup('c', '2026-05-01T00:00:00Z', {
            isArchivedByMe: true,
        });
        expect(resolveFavoriteGroupId(null, [onlyArchived])).toBe('c');
    });
});
