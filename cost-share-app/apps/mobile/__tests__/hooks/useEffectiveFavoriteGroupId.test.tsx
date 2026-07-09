import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { useAppStore } from '../../store';
import { useEffectiveFavoriteGroupId } from '../../hooks/useEffectiveFavoriteGroupId';
import { GroupWithMembers } from '@cost-share/shared';

function makeGroup(id: string, updatedAt: string): GroupWithMembers {
    return {
        id,
        name: `Group ${id}`,
        groupType: 'general',
        defaultCurrency: 'ILS',
        updatedAt: new Date(updatedAt),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [],
    } as unknown as GroupWithMembers;
}

function Probe() {
    const id = useEffectiveFavoriteGroupId();
    return <Text testID="effective">{id ?? 'none'}</Text>;
}

function renderProbe() {
    return render(
        <QueryClientProvider client={queryClient}>
            <Probe />
        </QueryClientProvider>,
    );
}

const groups = [
    makeGroup('a', '2026-01-01T00:00:00Z'),
    makeGroup('b', '2026-03-01T00:00:00Z'),
];

beforeEach(() => {
    queryClient.clear();
    useAppStore.setState({ favoriteGroupId: null });
});

describe('useEffectiveFavoriteGroupId', () => {
    it('returns null when there are no groups', () => {
        queryClient.setQueryData(queryKeys.groups, []);
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('none');
    });

    it('falls back to the first group when nothing is stored', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('b');
    });

    it('honors a stored valid id', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        useAppStore.setState({ favoriteGroupId: 'a' });
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('a');
    });

    it('falls back to the first group when the stored id is no longer a member group', () => {
        queryClient.setQueryData(queryKeys.groups, groups);
        useAppStore.setState({ favoriteGroupId: 'deleted-group' });
        const { getByTestId } = renderProbe();
        expect(getByTestId('effective').props.children).toBe('b');
    });
});
