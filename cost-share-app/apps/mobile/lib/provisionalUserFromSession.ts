import type { Session } from '@supabase/supabase-js';
import type { User } from '@cost-share/shared';
import { DEFAULT_CURRENCY } from '@cost-share/shared';

/** Minimal profile when DB hydration is slow or temporarily unavailable. */
export function provisionalUserFromSession(session: Session): User {
    const meta = session.user.user_metadata ?? {};
    const metaName =
        typeof meta.full_name === 'string'
            ? meta.full_name
            : typeof meta.name === 'string'
              ? meta.name
              : '';
    const email = session.user.email ?? undefined;
    const now = new Date();
    return {
        id: session.user.id,
        name: metaName.trim() || (email ? email.split('@')[0] : ''),
        email,
        avatarUrl: typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined,
        phone: undefined,
        inviteToken: '',
        defaultCurrency: DEFAULT_CURRENCY,
        language: 'en',
        isActive: true,
        isAdmin: false,
        createdAt: now,
        updatedAt: now,
    };
}
