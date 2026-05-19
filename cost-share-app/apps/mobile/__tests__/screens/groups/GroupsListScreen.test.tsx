import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/groups.service', () => ({
    fetchGroups: jest.fn().mockResolvedValue([]),
}));

import { GroupsListScreen } from '../../../screens/groups/GroupsListScreen';
import { useAppStore } from '../../../store';
import { fetchGroups } from '../../../services/groups.service';

const mockFetchGroups = fetchGroups as jest.MockedFunction<typeof fetchGroups>;

const sampleGroup = {
    id: 'g1',
    name: 'Trip',
    description: 'A trip',
    groupType: 'trip' as const,
    defaultCurrency: 'USD',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchGroups.mockClear();
    useAppStore.setState({ groups: [] });
});

describe('GroupsListScreen', () => {
    it('calls fetchGroups on mount', async () => {
        render(<GroupsListScreen />);
        await waitFor(() => expect(mockFetchGroups).toHaveBeenCalled());
    });

    it('shows EmptyState when no groups exist', async () => {
        const { findByText } = render(<GroupsListScreen />);
        expect(await findByText('groups.noGroups')).toBeTruthy();
    });

    it('renders groups from store', async () => {
        useAppStore.setState({ groups: [sampleGroup] });
        const { findByText } = render(<GroupsListScreen />);
        expect(await findByText('Trip')).toBeTruthy();
    });

    it('navigates to CreateGroup when create button is pressed', async () => {
        const { findAllByText } = render(<GroupsListScreen />);
        const buttons = await findAllByText('groups.createGroup');
        fireEvent.press(buttons[0]);
        expect(mockNavigate).toHaveBeenCalledWith('CreateGroup');
    });

    it('navigates to GroupDetail when a group is pressed', async () => {
        useAppStore.setState({ groups: [sampleGroup] });
        const { findByText } = render(<GroupsListScreen />);
        fireEvent.press(await findByText('Trip'));
        expect(mockNavigate).toHaveBeenCalledWith('GroupDetail', { groupId: 'g1' });
    });
});
