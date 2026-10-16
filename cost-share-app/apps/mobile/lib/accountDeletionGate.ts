import { assertProfileActiveWithTimeout, type ProfileStatus } from './auth';
import { getMyAccountDeletionState } from '../services/account.service';

export type AccountDeletionGate = 'active' | 'deleted' | 'restorable';

/**
 * After OAuth establishes a Supabase session, decide whether the user may enter
 * the app, is permanently deleted, or may self-restore within the grace window.
 */
export async function resolveAccountDeletionGate(
    profileStatus?: ProfileStatus,
): Promise<AccountDeletionGate> {
    const status = profileStatus ?? await assertProfileActiveWithTimeout();
    if (status !== 'deactivated') {
        return 'active';
    }
    const state = await getMyAccountDeletionState();
    if (state.canRestore) {
        return 'restorable';
    }
    return 'deleted';
}
