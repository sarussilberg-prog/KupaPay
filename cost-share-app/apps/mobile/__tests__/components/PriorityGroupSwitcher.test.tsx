import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PriorityGroupSwitcher } from '../../components/priorityGroup/PriorityGroupSwitcher';
import { useAppStore } from '../../store';
import { GroupWithMembers } from '@cost-share/shared';

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

const groups = [makeGroup('g1', 'Trip'), makeGroup('g2', 'Roommates')];

beforeEach(() => {
    useAppStore.setState({ priorityGroupId: null });
});

describe('PriorityGroupSwitcher', () => {
    it('shows the current group name on the switch button', () => {
        const { getByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        expect(getByTestId('priority-switch-btn')).toBeTruthy();
        expect(getByTestId('priority-switch-label').props.children).toBe('Trip');
    });

    it('opens the picker when the switch button is tapped', () => {
        const { getByTestId, queryByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        // Sheet row not present until opened.
        expect(queryByTestId('group-picker-row-g2')).toBeNull();
        fireEvent.press(getByTestId('priority-switch-btn'));
        expect(getByTestId('group-picker-row-g2')).toBeTruthy();
    });

    it('selecting a group stores it and closes the picker', () => {
        const { getByTestId, queryByTestId } = render(
            <PriorityGroupSwitcher groupId="g1" groupName="Trip" groups={groups} />,
        );
        fireEvent.press(getByTestId('priority-switch-btn'));
        fireEvent.press(getByTestId('group-picker-row-g2'));
        expect(useAppStore.getState().priorityGroupId).toBe('g2');
        // Picker closed → row gone.
        expect(queryByTestId('group-picker-row-g2')).toBeNull();
    });
});
