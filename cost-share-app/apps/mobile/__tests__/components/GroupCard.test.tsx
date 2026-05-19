import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupCard } from '../../components/GroupCard';
import type { Group } from '@cost-share/shared';

const baseGroup: Group = {
    id: 'g1',
    name: 'Trip to Paris',
    description: 'Summer trip',
    groupType: 'trip',
    defaultCurrency: 'EUR',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('GroupCard', () => {
    it('renders group name and description', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => { }} />
        );
        expect(getByText('Trip to Paris')).toBeTruthy();
        expect(getByText('Summer trip')).toBeTruthy();
    });

    it('renders group type label via i18n key', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={() => { }} />
        );
        expect(getByText('groups.types.trip')).toBeTruthy();
    });

    it('renders member count when provided', () => {
        const { getByText } = render(
            <GroupCard group={baseGroup} memberCount={4} onPress={() => { }} />
        );
        // Member count is rendered next to a bullet (e.g., "• 4 groups.members")
        expect(getByText(/4/)).toBeTruthy();
    });

    it('calls onPress with the group id', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <GroupCard group={baseGroup} onPress={onPress} />
        );
        fireEvent.press(getByText('Trip to Paris'));
        expect(onPress).toHaveBeenCalledWith('g1');
    });

    it('renders group image when imageUrl is provided', () => {
        const { getByTestId } = render(
            <GroupCard
                group={{ ...baseGroup, imageUrl: 'https://example.com/group.jpg' }}
                onPress={() => {}}
            />
        );
        expect(getByTestId('group-avatar-image')).toBeTruthy();
    });
});
