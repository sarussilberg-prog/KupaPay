import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AdminMonetizationScreen } from '../../../screens/admin/AdminMonetizationScreen';
import { AdminMonetizationMetricsError } from '../../../services/admin.service';

const mockUseQuery = jest.fn();

jest.mock('../../../hooks/queries/useAdminMonetizationMetricsQuery', () => ({
    useAdminMonetizationMetricsQuery: () => mockUseQuery(),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('AdminMonetizationScreen', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
    });

    it('shows loading state', () => {
        mockUseQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
        const { getByTestId } = render(<AdminMonetizationScreen />);
        expect(getByTestId('admin-monetization-loading')).toBeTruthy();
    });

    it('shows analytics unavailable empty state when RPC is not configured', async () => {
        mockUseQuery.mockReturnValue({
            isLoading: false,
            isError: true,
            error: new AdminMonetizationMetricsError('analytics_unavailable'),
            data: undefined,
            isRefetching: false,
            refetch: jest.fn(),
        });
        const { getByTestId, getByText } = render(<AdminMonetizationScreen />);
        await waitFor(() => {
            expect(getByTestId('admin-monetization-unconfigured')).toBeTruthy();
        });
        expect(getByText('admin.metrics.analyticsUnavailableTitle')).toBeTruthy();
    });

    it('renders metrics when query succeeds', () => {
        mockUseQuery.mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                funnel: {
                    ad_gate_shown: 1,
                    ad_gate_watch_tapped: 0,
                    ad_gate_watch_completed: 0,
                    ad_gate_pro_tapped: 0,
                    remind_sent: 0,
                },
                by_feature: {},
                by_platform: { ios: 1 },
                daily: [],
            },
            isRefetching: false,
            refetch: jest.fn(),
        });
        const { getByTestId } = render(<AdminMonetizationScreen />);
        expect(getByTestId('admin-monetization-screen')).toBeTruthy();
    });
});
