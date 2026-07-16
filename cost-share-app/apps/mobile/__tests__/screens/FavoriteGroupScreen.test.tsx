import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { GroupWithMembers } from '@cost-share/shared';

// Local nav mock: the global jest-setup mock omits setParams, which this
// screen calls in a useLayoutEffect to feed GroupDetailScreen its groupId.
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: jest.fn(),
            setParams: jest.fn(),
        }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

// Mock the effective-id hook so we drive the two branches directly.
jest.mock('../../hooks/useEffectiveFavoriteGroupId', () => ({
    useEffectiveFavoriteGroupId: jest.fn(),
}));
// Stub GroupDetailScreen — its real behavior (incl. the switcher button
// rendered inside SummaryCover via onSwitcherPress) is covered by its own
// suite and by SummaryCover.test.tsx. Here we only assert FavoriteGroupScreen
// wires the right props through.
jest.mock('../../screens/groups/GroupDetailScreen', () => ({
    GroupDetailScreen: (props: { showBack?: boolean; onSwitcherPress?: () => void }) => {
        const { Text } = require('react-native');
        return (
            <Text
                testID="group-detail-stub"
                onPress={props.onSwitcherPress}
            >
                {`detail:showBack=${String(props.showBack)}`}
            </Text>
        );
    },
}));

import { useEffectiveFavoriteGroupId } from '../../hooks/useEffectiveFavoriteGroupId';
import { FavoriteGroupScreen } from '../../screens/favoriteGroup/FavoriteGroupScreen';

function makeGroup(id: string, name: string): GroupWithMembers {
    return {
        id,
        name,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

function renderScreen() {
    return render(
        <QueryClientProvider client={queryClient}>
            <FavoriteGroupScreen />
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    queryClient.clear();
    (useEffectiveFavoriteGroupId as jest.Mock).mockReset();
});

describe('FavoriteGroupScreen', () => {
    it('renders the empty state with a create CTA when there is no group', () => {
        (useEffectiveFavoriteGroupId as jest.Mock).mockReturnValue(null);
        queryClient.setQueryData(queryKeys.groups, []);
        const { getByTestId, queryByTestId } = renderScreen();
        expect(getByTestId('favorite-empty')).toBeTruthy();
        expect(queryByTestId('group-detail-stub')).toBeNull();
    });

    it('renders GroupDetail flush-top with the switcher wired via onSwitcherPress', () => {
        (useEffectiveFavoriteGroupId as jest.Mock).mockReturnValue('g1');
        queryClient.setQueryData(queryKeys.groups, [makeGroup('g1', 'Trip')]);
        const { getByTestId } = renderScreen();
        const stub = getByTestId('group-detail-stub');
        expect(stub.props.children).toBe('detail:showBack=false');
        expect(typeof stub.props.onPress).toBe('function');
    });
});
