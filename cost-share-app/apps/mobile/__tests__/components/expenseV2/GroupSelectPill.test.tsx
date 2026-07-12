import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GroupSelectPill } from '../../../components/expenseV2/GroupSelectPill';

describe('GroupSelectPill', () => {
    it('renders the current group name', () => {
        const { getByText, getByTestId } = render(
            <GroupSelectPill groupName="Trip" groupType="trip" onPress={() => {}} />,
        );
        expect(getByTestId('add-expense-group-pill')).toBeTruthy();
        expect(getByText('Trip')).toBeTruthy();
    });

    it('renders the "Group" label outside the tappable control', () => {
        const { getByTestId } = render(
            <GroupSelectPill groupName="Trip" groupType="trip" onPress={() => {}} />,
        );
        // In tests i18n returns the raw key.
        const label = getByTestId('add-expense-group-label');
        expect(label).toBeTruthy();
        expect(label.props.children).toBe('expenses.v2.changeGroup');
        // The label must live OUTSIDE the tappable control (not nested inside it).
        const control = getByTestId('add-expense-group-pill');
        const nestedLabels = control.findAllByProps({ testID: 'add-expense-group-label' });
        expect(nestedLabels).toHaveLength(0);
    });

    it('calls onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <GroupSelectPill groupName="Trip" groupType="trip" onPress={onPress} />,
        );
        fireEvent.press(getByTestId('add-expense-group-pill'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('exposes an accessible label for the control', () => {
        const { getByTestId } = render(
            <GroupSelectPill groupName="Flat" groupType="general" onPress={() => {}} />,
        );
        // In tests i18n returns the raw key.
        expect(getByTestId('add-expense-group-pill').props.accessibilityLabel).toBe(
            'expenses.v2.changeGroup',
        );
    });
});
