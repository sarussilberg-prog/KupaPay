import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/activity.service', () => ({
    fetchRecentActivity: jest.fn(),
    ACTIVITY_INITIAL_PAGE_SIZE: 15,
    ACTIVITY_PAGE_SIZE: 20,
}));

import { ActivityFeedScreen } from '../../../screens/activity/ActivityFeedScreen';
import { fetchRecentActivity } from '../../../services/activity.service';

const mockFetchRecentActivity = fetchRecentActivity as jest.MockedFunction<
    typeof fetchRecentActivity
>;

function renderWithQuery(ui: React.ReactElement) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    );
}

beforeEach(() => {
    mockFetchRecentActivity.mockReset();
});

describe('ActivityFeedScreen', () => {
    it('shows empty state when no activities', async () => {
        mockFetchRecentActivity.mockResolvedValue({ items: [] });
        const { findByText } = renderWithQuery(<ActivityFeedScreen />);
        expect(await findByText('activity.noActivity')).toBeTruthy();
    });

    it('renders activities when present', async () => {
        mockFetchRecentActivity.mockResolvedValue({
            items: [
                {
                    id: 'a1',
                    activityType: 'expense',
                    groupId: 'g1',
                    description: 'Lunch',
                    amount: 12,
                    currency: 'USD',
                    userId: 'u1',
                    userName: 'Alice',
                    activityDate: new Date('2026-05-01'),
                    createdAt: new Date(),
                },
            ],
        });
        const { findByText } = renderWithQuery(<ActivityFeedScreen />);
        expect(await findByText('Lunch')).toBeTruthy();
    });

    it('filters activities by search query', async () => {
        mockFetchRecentActivity.mockResolvedValue({
            items: [
                {
                    id: 'a1',
                    activityType: 'expense',
                    groupId: 'g1',
                    description: 'Lunch',
                    amount: 12,
                    currency: 'USD',
                    userId: 'u1',
                    userName: 'Alice',
                    activityDate: new Date('2026-05-01'),
                    createdAt: new Date(),
                },
                {
                    id: 'a2',
                    activityType: 'expense',
                    groupId: 'g1',
                    description: 'Dinner',
                    amount: 20,
                    currency: 'USD',
                    userId: 'u2',
                    userName: 'Bob',
                    activityDate: new Date('2026-05-02'),
                    createdAt: new Date(),
                },
            ],
        });

        const { findByText, findByTestId, queryByText } = renderWithQuery(
            <ActivityFeedScreen />,
        );
        expect(await findByText('Lunch')).toBeTruthy();

        fireEvent.changeText(await findByTestId('activity-search-input'), 'Dinner');

        expect(await findByText('Dinner')).toBeTruthy();
        expect(queryByText('Lunch')).toBeNull();
    });

    it('renders group messages in the feed', async () => {
        mockFetchRecentActivity.mockResolvedValue({
            items: [
                {
                    id: 'm1',
                    activityType: 'message',
                    groupId: 'g1',
                    description: 'Hello everyone',
                    amount: 0,
                    currency: '',
                    userId: 'u1',
                    userName: 'Alice',
                    activityDate: new Date('2026-05-01'),
                    createdAt: new Date(),
                },
            ],
        });
        const { findByText } = renderWithQuery(<ActivityFeedScreen />);
        expect(await findByText('Hello everyone')).toBeTruthy();
    });

    it('fetches activity only once on mount (no double-fetch)', async () => {
        mockFetchRecentActivity.mockResolvedValue({ items: [] });
        renderWithQuery(<ActivityFeedScreen />);

        await waitFor(() => {
            expect(mockFetchRecentActivity).toHaveBeenCalledTimes(1);
        });
    });

    it('does not auto-fetch next page before user scrolls', async () => {
        mockFetchRecentActivity.mockResolvedValue({
            items: Array.from({ length: 15 }, (_, i) => ({
                id: `a${i}`,
                activityType: 'expense' as const,
                groupId: 'g1',
                description: `Item ${i}`,
                amount: 10,
                currency: 'USD',
                userId: 'u1',
                userName: 'Alice',
                activityDate: new Date('2026-05-01'),
                createdAt: new Date(`2026-05-01T00:00:${String(i).padStart(2, '0')}.000Z`),
            })),
            nextCursor: '2026-05-01T00:00:00.000Z',
        });

        renderWithQuery(<ActivityFeedScreen />);

        await waitFor(() => {
            expect(mockFetchRecentActivity).toHaveBeenCalledTimes(1);
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockFetchRecentActivity).toHaveBeenCalledTimes(1);
    });
});
