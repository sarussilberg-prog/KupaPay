import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GroupPickerSheet } from '../../components/favoriteGroup/GroupPickerSheet';
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

describe('GroupPickerSheet', () => {
    it('renders a row per group when visible', () => {
        const { getByText } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={() => {}}
            />,
        );
        expect(getByText('Trip')).toBeTruthy();
        expect(getByText('Roommates')).toBeTruthy();
    });

    it('calls onSelectGroup with the tapped group id', () => {
        const onSelectGroup = jest.fn();
        const { getByTestId } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={onSelectGroup}
                onClose={() => {}}
            />,
        );
        fireEvent.press(getByTestId('group-picker-row-g2'));
        expect(onSelectGroup).toHaveBeenCalledTimes(1);
        expect(onSelectGroup).toHaveBeenCalledWith('g2');
    });

    it('closes via the scrim', () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={onClose}
            />,
        );
        fireEvent.press(getByTestId('group-picker-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders a custom title when provided', () => {
        const { getByText } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={() => {}}
                title="Custom title"
            />,
        );
        expect(getByText('Custom title')).toBeTruthy();
    });

    it('falls back to the favorite-group title when no title prop is given', () => {
        const { getByText } = render(
            <GroupPickerSheet
                visible
                groups={groups}
                selectedGroupId="g1"
                onSelectGroup={() => {}}
                onClose={() => {}}
            />,
        );
        // In tests i18n returns the raw key; the important invariant is that the
        // default title is still driven by the favorite-group key (unchanged for
        // existing callers).
        expect(getByText('favoriteGroup.pickerTitle')).toBeTruthy();
    });
});
