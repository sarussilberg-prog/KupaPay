import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockRequestEmailOtp = jest.fn();
const mockVerifyEmailOtp = jest.fn();

jest.mock('../../../services/emailOtpAuth.service', () => ({
    requestEmailOtp: (...args: unknown[]) => mockRequestEmailOtp(...args),
    verifyEmailOtp: (...args: unknown[]) => mockVerifyEmailOtp(...args),
}));

import { LoginEmailOtpAuth } from '../../../components/auth/LoginEmailOtpAuth';

describe('LoginEmailOtpAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows continue button then email step', () => {
        const { getByTestId, queryByTestId } = render(
            <LoginEmailOtpAuth onAuthResult={jest.fn()} />,
        );
        expect(getByTestId('login-email-continue-button')).toBeTruthy();
        expect(queryByTestId('login-email-input')).toBeNull();
        fireEvent.press(getByTestId('login-email-continue-button'));
        expect(getByTestId('login-email-input')).toBeTruthy();
    });

    it('moves to code step after successful send', async () => {
        mockRequestEmailOtp.mockResolvedValueOnce({ error: null });
        const { getByTestId } = render(<LoginEmailOtpAuth onAuthResult={jest.fn()} />);
        fireEvent.press(getByTestId('login-email-continue-button'));
        fireEvent.changeText(getByTestId('login-email-input'), 'user@test.com');
        fireEvent.press(getByTestId('login-email-send-code-button'));
        await waitFor(() => expect(getByTestId('login-email-otp-input')).toBeTruthy());
    });

    it('calls onAuthResult when verify succeeds', async () => {
        mockRequestEmailOtp.mockResolvedValue({ error: null });
        mockVerifyEmailOtp.mockResolvedValueOnce({ error: null });
        const onAuthResult = jest.fn();
        const { getByTestId } = render(<LoginEmailOtpAuth onAuthResult={onAuthResult} />);
        fireEvent.press(getByTestId('login-email-continue-button'));
        fireEvent.changeText(getByTestId('login-email-input'), 'user@test.com');
        fireEvent.press(getByTestId('login-email-send-code-button'));
        await waitFor(() => expect(getByTestId('login-email-otp-input')).toBeTruthy());
        fireEvent.changeText(getByTestId('login-email-otp-input'), '123456');
        fireEvent.press(getByTestId('login-email-verify-button'));
        await waitFor(() => expect(onAuthResult).toHaveBeenCalledWith({ error: null }));
    });
});
