import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AdminGrowthMetricsScreen } from '../../../screens/admin/AdminGrowthMetricsScreen';
import { AdminGrowthMetricsError } from '../../../services/admin.service';

const mockUseQuery = jest.fn();

jest.mock('../../../hooks/queries/useAdminGrowthMetricsQuery', () => ({
    useAdminGrowthMetricsQuery: () => mockUseQuery(),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe('AdminGrowthMetricsScreen', () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
    });

    it('shows loading state', () => {
        mockUseQuery.mockReturnValue({ isLoading: true, isError: false, data: undefined });
        const { getByTestId } = render(<AdminGrowthMetricsScreen />);
        expect(getByTestId('admin-growth-loading')).toBeTruthy();
    });

    it('shows not admin empty state', async () => {
        mockUseQuery.mockReturnValue({
            isLoading: false,
            isError: true,
            error: new AdminGrowthMetricsError('not_admin'),
            data: undefined,
            isRefetching: false,
            refetch: jest.fn(),
        });
        const { getByTestId } = render(<AdminGrowthMetricsScreen />);
        await waitFor(() => {
            expect(getByTestId('admin-growth-not-admin')).toBeTruthy();
        });
    });

    it('renders north star and MAU when query succeeds', () => {
        mockUseQuery.mockReturnValue({
            isLoading: false,
            isError: false,
            data: {
                asOf: '2026-10-27T08:00:00Z',
                northStar: {
                    definition: 'monthly_active_groups_with_two_plus_expense_authors',
                    currentMonth: '2026-10',
                    currentMonthCount: 5,
                    previousMonth: '2026-09',
                    previousMonthCount: 3,
                },
                activeExpenseAuthors: { dau: 1, wau: 10, mau: 40, note: '' },
                northStarMonthlySeries: [{ month: '2026-10', northStarGroups: 5 }],
            },
            isRefetching: false,
            refetch: jest.fn(),
        });
        const { getByTestId, getAllByText } = render(<AdminGrowthMetricsScreen />);
        expect(getByTestId('admin-growth-screen')).toBeTruthy();
        expect(getAllByText('5').length).toBeGreaterThan(0);
        expect(getAllByText('40').length).toBeGreaterThan(0);
    });
});
