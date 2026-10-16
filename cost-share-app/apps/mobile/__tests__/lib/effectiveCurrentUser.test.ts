import { effectiveCurrentUser } from '../../lib/effectiveCurrentUser';
import type { User } from '@cost-share/shared';

const session = {
    user: {
        id: 'user-1',
        email: 'naveh@example.com',
        user_metadata: { full_name: 'Naveh' },
    },
} as any;

describe('effectiveCurrentUser', () => {
    it('returns hydrated profile when present', () => {
        const hydrated = { id: 'user-1', name: 'Naveh Silberg' } as User;
        expect(effectiveCurrentUser(session, hydrated)).toBe(hydrated);
    });

    it('falls back to session metadata when profile hydration failed', () => {
        const effective = effectiveCurrentUser(session, null);
        expect(effective?.id).toBe('user-1');
        expect(effective?.name).toBe('Naveh');
    });

    it('returns null when signed out', () => {
        expect(effectiveCurrentUser(null, null)).toBeNull();
    });
});
