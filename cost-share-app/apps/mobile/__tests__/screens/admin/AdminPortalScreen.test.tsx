const mockNavigate = jest.fn();

jest.mock('../../../hooks/queries/useAdminPlatformMetricsQuery', () => ({
    useAdminPlatformMetricsQuery: () => ({
        data: {
            version: 1,
            generatedAt: '2026-06-02T12:00:00Z',
            users: { registered: 1, deleted: 0 },
            groups: { active: 2, archived: 1, deleted: 0, manualArchiveMemberships: 0 },
        },
        isLoading: false,
        isError: false,
        isRefetching: false,
        refetch: jest.fn(),
    }),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

jest.mock('../../../lib/appToast', () => ({
    showSuccessMessage: jest.fn(),
}));

jest.mock('../../../lib/onboardingStorage', () => ({
    clearOnboardingFlags: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { showSuccessMessage } from '../../../lib/appToast';
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
        expect(showSuccessMessage).toHaveBeenCalledWith('admin.onboarding.resetSuccess');
    });

    it('renders preview onboarding row', () => {
        const { getByTestId } = render(<AdminPortalScreen />);
        expect(getByTestId('admin-portal-preview-onboarding')).toBeTruthy();
    });

    it('renders AdminMetricsPanel with metrics data', () => {
        const { getByTestId } = render(<AdminPortalScreen />);
        expect(getByTestId('admin-metrics-panel')).toBeTruthy();
    });
});
