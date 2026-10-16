import {
    isValidEmailFormat,
    mapEmailOtpSendError,
    mapEmailOtpVerifyError,
    normalizeEmailInput,
} from '../../lib/authEmailOtpErrors';

describe('authEmailOtpErrors', () => {
    it('normalizes email to lower case', () => {
        expect(normalizeEmailInput('  User@Example.COM ')).toBe('user@example.com');
    });

    it('validates email format', () => {
        expect(isValidEmailFormat('a@b.co')).toBe(true);
        expect(isValidEmailFormat('not-an-email')).toBe(false);
    });

    it('maps rate limit on send', () => {
        const err = mapEmailOtpSendError({ message: 'Email rate limit exceeded', status: 429 });
        expect(err.message).toBe('email_otp_rate_limited');
    });

    it('maps deleted email on verify', () => {
        const err = mapEmailOtpVerifyError(new Error('email_was_deleted'));
        expect(err.code).toBe('account_deleted');
    });

    it('maps invalid otp', () => {
        const err = mapEmailOtpVerifyError({ message: 'Token has expired or is invalid' });
        expect(err.message).toBe('email_otp_invalid');
    });
});
