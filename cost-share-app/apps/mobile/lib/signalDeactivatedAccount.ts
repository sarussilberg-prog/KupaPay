import { Platform } from 'react-native';
import { markDeactivationNoticePending } from './deactivationNoticeStorage';

/** Flip in-memory + persisted flags so LoginScreen can show the deleted-account notice. */
export async function signalDeactivatedAccount(
    setPendingDeactivationNotice: (value: boolean) => void,
): Promise<void> {
    setPendingDeactivationNotice(true);
    // Persist only on web: full-page OAuth reload drops the in-memory Zustand flag.
    // Native cold starts must not replay a stale dialog when the user never signed in.
    if (Platform.OS === 'web') {
        await markDeactivationNoticePending();
    }
}
