const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
            verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
        },
    },
}));

const mockClearStaleAuthSession = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/authSessionLifecycle', () => ({
    clearStaleAuthSession: (...args: unknown[]) => mockClearStaleAuthSession(...args),
}));

const mockSignalDeactivatedAccount = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/signalDeactivatedAccount', () => ({
    signalDeactivatedAccount: (...args: unknown[]) => mockSignalDeactivatedAccount(...args),
}));

const mockSetPendingAccountRestore = jest.fn();
jest.mock('../../store', () => ({
    useAppStore: {
        getState: () => ({
            setPendingAccountRestore: mockSetPendingAccountRestore,
            setPendingDeactivationNotice: jest.fn(),
        }),
    },
}));

const mockResolveAccountDeletionGate = jest.fn().mockResolvedValue('active');
jest.mock('../../lib/accountDeletionGate', () => ({
    resolveAccountDeletionGate: (...args: unknown[]) => mockResolveAccountDeletionGate(...args),
}));

import { requestEmailOtp, verifyEmailOtp } from '../../services/emailOtpAuth.service';

describe('emailOtpAuth.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockResolveAccountDeletionGate.mockResolvedValue('active');
    });

    it('requestEmailOtp rejects invalid email locally', async () => {
        const result = await requestEmailOtp('bad');
        expect(result.error?.message).toBe('email_otp_invalid_email');
        expect(mockSignInWithOtp).not.toHaveBeenCalled();
    });

    it('requestEmailOtp calls signInWithOtp with normalized email', async () => {
        mockSignInWithOtp.mockResolvedValueOnce({ error: null });
        await requestEmailOtp('User@Test.com');
        expect(mockSignInWithOtp).toHaveBeenCalledWith({
            email: 'user@test.com',
            options: { shouldCreateUser: true },
        });
    });

    it('verifyEmailOtp rejects short codes', async () => {
        const result = await verifyEmailOtp('a@b.co', '123');
        expect(result.error?.message).toBe('email_otp_invalid');
        expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it('verifyEmailOtp gates restorable accounts', async () => {
        mockVerifyOtp.mockResolvedValueOnce({ error: null });
        mockResolveAccountDeletionGate.mockResolvedValueOnce('restorable');
        const result = await verifyEmailOtp('a@b.co', '123456');
        expect(result.error?.code).toBe('account_restorable');
        expect(mockSetPendingAccountRestore).toHaveBeenCalledWith(true);
    });

    it('verifyEmailOtp succeeds when gate is active', async () => {
        mockVerifyOtp.mockResolvedValueOnce({ error: null });
        const result = await verifyEmailOtp('a@b.co', '123456');
        expect(result.error).toBeNull();
    });
});
