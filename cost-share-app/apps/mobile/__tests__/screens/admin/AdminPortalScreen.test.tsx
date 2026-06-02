const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

jest.mock('../../../lib/onboardingStorage', () => ({
    clearOnboardingFlags: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { AdminPortalScreen } from '../../../screens/admin/AdminPortalScreen';
import { clearOnboardingFlags } from '../../../lib/onboardingStorage';

describe('AdminPortalScreen onboarding tools', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('clears flags and opens preview when reset is confirmed', async () => {
        const { getByTestId } = render(<AdminPortalScreen />);
        fireEvent.press(getByTestId('admin-portal-reset-onboarding'));
        fireEvent.press(getByTestId('admin-onboarding-reset-confirm'));

        await waitFor(() => expect(clearOnboardingFlags).toHaveBeenCalled());
        expect(mockNavigate).toHaveBeenCalledWith('AdminOnboardingPreview');
        expect(Toast.show).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        );
    });

    it('renders preview onboarding row', () => {
        const { getByTestId } = render(<AdminPortalScreen />);
        expect(getByTestId('admin-portal-preview-onboarding')).toBeTruthy();
    });
});
