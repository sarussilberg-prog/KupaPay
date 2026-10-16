import { supabase } from '../lib/supabase';
import {
    isValidEmailFormat,
    mapEmailOtpSendError,
    mapEmailOtpVerifyError,
    normalizeEmailInput,
} from '../lib/authEmailOtpErrors';
import type { AuthError } from './auth.service';
import { clearStaleAuthSession } from '../lib/authSessionLifecycle';
import { signalDeactivatedAccount } from '../lib/signalDeactivatedAccount';
import { resolveAccountDeletionGate } from '../lib/accountDeletionGate';
import { useAppStore } from '../store';

async function rejectDeletedAccount(): Promise<{ error: AuthError }> {
    await clearStaleAuthSession();
    await signalDeactivatedAccount(useAppStore.getState().setPendingDeactivationNotice);
    return { error: { code: 'account_deleted', message: 'account deleted' } satisfies AuthError };
}

async function gateFreshSignInSession(): Promise<{ error: AuthError | null }> {
    const gate = await resolveAccountDeletionGate();
    if (gate === 'active') {
        return { error: null };
    }
    if (gate === 'restorable') {
        useAppStore.getState().setPendingAccountRestore(true);
        return { error: { code: 'account_restorable', message: 'account restorable' } satisfies AuthError };
    }
    return rejectDeletedAccount();
}

export async function requestEmailOtp(rawEmail: string): Promise<{ error: AuthError | null }> {
    const email = normalizeEmailInput(rawEmail);
    if (!isValidEmailFormat(email)) {
        return { error: { code: 'generic', message: 'email_otp_invalid_email' } };
    }

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
        },
    });

    if (error) {
        return { error: mapEmailOtpSendError(error) };
    }

    return { error: null };
}

export async function verifyEmailOtp(
    rawEmail: string,
    rawToken: string,
): Promise<{ error: AuthError | null }> {
    const email = normalizeEmailInput(rawEmail);
    const token = rawToken.replace(/\D/g, '').trim();

    if (!isValidEmailFormat(email)) {
        return { error: { code: 'generic', message: 'email_otp_invalid_email' } };
    }
    if (token.length !== 6) {
        return { error: { code: 'generic', message: 'email_otp_invalid' } };
    }

    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    });

    if (error) {
        return { error: mapEmailOtpVerifyError(error) };
    }

    const gated = await gateFreshSignInSession();
    if (gated.error) {
        return gated;
    }

    return { error: null };
}
