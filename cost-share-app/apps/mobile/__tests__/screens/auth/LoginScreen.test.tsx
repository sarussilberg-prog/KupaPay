import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/auth.service', () => ({
    signInWithGoogle: jest.fn(),
}));

import { LoginScreen } from '../../../screens/auth/LoginScreen';
import { signInWithGoogle } from '../../../services/auth.service';
import Toast from 'react-native-toast-message';

const mockSignIn = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>;

describe('LoginScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the app name and subtitle', () => {
        const { getByText } = render(<LoginScreen />);
        expect(getByText('auth.appName')).toBeTruthy();
        expect(getByText('auth.subtitle')).toBeTruthy();
    });

    it('renders the Google sign-in button', () => {
        const { getByText } = render(<LoginScreen />);
        expect(getByText('auth.signInWithGoogle')).toBeTruthy();
    });

    it('calls signInWithGoogle on button press', async () => {
        mockSignIn.mockResolvedValueOnce({ error: null });
        const { getByText } = render(<LoginScreen />);
        fireEvent.press(getByText('auth.signInWithGoogle'));
        await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    });

    it('shows an error toast when sign-in fails', async () => {
        mockSignIn.mockResolvedValueOnce({ error: new Error('boom') });
        const { getByText } = render(<LoginScreen />);
        fireEvent.press(getByText('auth.signInWithGoogle'));
        await waitFor(() =>
            expect(Toast.show).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' })
            )
        );
    });
});
