import {
    isGroupPassActive,
    isIndividualProActive,
    resolveProMembershipSource,
} from '../proMembership';

describe('proMembership', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');

    it('detects individual and group pass activity', () => {
        expect(isIndividualProActive({ individualProUntil: '2026-12-01T00:00:00.000Z' }, now)).toBe(
            true,
        );
        expect(isGroupPassActive({ groupPassUntil: '2026-07-01T00:00:00.000Z' }, now)).toBe(true);
    });

    it('resolves membership source', () => {
        expect(resolveProMembershipSource({}, now)).toBe('none');
        expect(
            resolveProMembershipSource({ individualProUntil: '2026-12-01T00:00:00.000Z' }, now),
        ).toBe('individual');
        expect(
            resolveProMembershipSource({ groupPassUntil: '2026-07-01T00:00:00.000Z' }, now),
        ).toBe('group_pass');
        expect(
            resolveProMembershipSource(
                {
                    individualProUntil: '2026-12-01T00:00:00.000Z',
                    groupPassUntil: '2026-07-01T00:00:00.000Z',
                },
                now,
            ),
        ).toBe('both');
    });
});
