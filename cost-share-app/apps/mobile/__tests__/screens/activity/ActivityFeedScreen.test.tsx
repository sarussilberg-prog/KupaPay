import React from 'react';
import { render } from '@testing-library/react-native';

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

jest.mock('../../../services/api', () => ({
    apiGet: jest.fn(),
}));

import { ActivityFeedScreen } from '../../../screens/activity/ActivityFeedScreen';
import { apiGet } from '../../../services/api';

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;

beforeEach(() => {
    mockApiGet.mockReset();
});

describe('ActivityFeedScreen', () => {
    it('renders the title', async () => {
        mockApiGet.mockResolvedValueOnce({ success: true, data: [] } as any);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('activity.title')).toBeTruthy();
    });

    it('shows empty state when no activities', async () => {
        mockApiGet.mockResolvedValueOnce({ success: true, data: [] } as any);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('activity.noActivity')).toBeTruthy();
    });

    it('renders activities when present', async () => {
        mockApiGet.mockResolvedValueOnce({
            success: true,
            data: [
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
        } as any);
        const { findByText } = render(<ActivityFeedScreen />);
        expect(await findByText('Lunch')).toBeTruthy();
    });
});
