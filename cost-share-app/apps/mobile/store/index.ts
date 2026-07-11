import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SuperJSON from 'superjson';
import { Session } from '@supabase/supabase-js';
import { User, PendingInvite } from '@cost-share/shared';

interface AppState {
    // Auth state
    session: Session | null;
    setSession: (session: Session | null) => void;

    // User state
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;

    // Language state
    language: 'en' | 'he';
    setLanguage: (language: 'en' | 'he') => void;

    // Pending invite — set when an invite link arrives before sign-in.
    pendingInvite: PendingInvite | null;
    setPendingInvite: (invite: PendingInvite | null) => void;

    /** Navigation deferred until AppNavigator mounts (invite redeem outside NavigationContainer). */
    pendingNavigation:
        | { target: 'friends' }
        | { target: 'groupDetail'; groupId: string }
        | { target: 'groupsList' }
        | { target: 'settleUpList'; groupId: string }
        | null;
    setPendingNavigation: (
        nav: AppState['pendingNavigation'],
    ) => void;

    // Deactivation notice — set when assertProfileActive detects a deactivated
    // (deleted) profile during sign-in. LoginScreen watches this flag and shows
    // an Alert once the user has been routed back. Reset after display.
    pendingDeactivationNotice: boolean;
    setPendingDeactivationNotice: (value: boolean) => void;

    // Favorite group — the group the "Favorite Group" tab opens on. Persisted.
    // Setter only stores the id; the effective/fallback resolution lives in
    // lib/favoriteGroup.ts so it can be unit-tested without a store.
    favoriteGroupId: string | null;
    setFavoriteGroupId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // Auth state
            session: null,
            // currentUser is owned by hydrateCurrentUserProfile (real profile row from DB).
            // setSession used to also derive a session-payload placeholder here, but that
            // clobbered the hydrated row in App.acceptSessionIfAllowed (hydrate-then-setSession
            // order) and on every TOKEN_REFRESHED event — making Settings show ILS while the
            // dashboard RPC returned the real currency. Sign-out (session=null) still clears both.
            setSession: (session) =>
                set((state) => ({
                    session,
                    currentUser: session ? state.currentUser : null,
                })),

            // User state
            currentUser: null,
            setCurrentUser: (user) => set({ currentUser: user }),

            // Language state
            language: 'en',
            setLanguage: (language) => set({ language }),

            // Pending invite state
            pendingInvite: null,
            setPendingInvite: (invite) => set({ pendingInvite: invite }),

            pendingNavigation: null,
            setPendingNavigation: (nav) => set({ pendingNavigation: nav }),

            // Deactivation notice flag
            pendingDeactivationNotice: false,
            setPendingDeactivationNotice: (value) => set({ pendingDeactivationNotice: value }),

            // Favorite group state
            favoriteGroupId: null,
            setFavoriteGroupId: (id) => set({ favoriteGroupId: id }),
        }),
        {
            name: 'app-store.v1',
            // SuperJSON round-trips Date / Map / Set / BigInt natively so the
            // currentUser's createdAt / updatedAt come back as Date objects.
            storage: {
                getItem: async (name) => {
                    const value = await AsyncStorage.getItem(name);
                    return value ? SuperJSON.parse(value) : null;
                },
                setItem: async (name, value) => {
                    await AsyncStorage.setItem(name, SuperJSON.stringify(value));
                },
                removeItem: async (name) => {
                    await AsyncStorage.removeItem(name);
                },
            } satisfies PersistStorage<Partial<AppState>>,
            // Persist only the slices that should survive across launches.
            // Session is owned by supabase auth; transient flags must reset.
            partialize: (state) => ({
                currentUser: state.currentUser,
                language: state.language,
                favoriteGroupId: state.favoriteGroupId,
            }),
            version: 1,
        },
    ),
);
