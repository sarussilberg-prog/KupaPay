import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../../services/auth.service', () => ({
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
}));

jest.mock('../../../lib/featureFlags', () => ({
    EMAIL_AUTH_ENABLED: true,
    SHOW_KUPAPAY_PRO_UPSELL: false,
    KUPAPAY_PRO_ENABLED: false,
    isProUpsellSurfaceEnabled: () => false,
}));

jest.mock('../../../components/AppLogoAnimated', () => {
    const React = require('react');
    const { View } = require('react-native');
    return { AppLogoAnimated: ({ testID = 'app-logo' }: { testID?: string }) => <View testID={testID} /> };
});

import { LoginScreen } from '../../../screens/auth/LoginScreen';

describe('LoginScreen email auth flag', () => {
    it('renders email OTP entry when flag enabled', () => {
        const { getByTestId } = render(<LoginScreen />);
        expect(getByTestId('login-email-otp-auth')).toBeTruthy();
        expect(getByTestId('login-email-continue-button')).toBeTruthy();
    });

    it('expands email flow from continue button', () => {
        const { getByTestId } = render(<LoginScreen />);
        fireEvent.press(getByTestId('login-email-continue-button'));
        expect(getByTestId('login-email-input')).toBeTruthy();
    });
});
