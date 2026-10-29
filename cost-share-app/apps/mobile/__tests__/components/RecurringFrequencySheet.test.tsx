import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecurringFrequencySheet } from '../../components/expenseV2/RecurringFrequencySheet';

describe('RecurringFrequencySheet', () => {
    it('shows a selection sheet without header Save', () => {
        const { queryByText, getByText } = render(
            <RecurringFrequencySheet
                visible
                value="monthly"
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />,
        );
        expect(getByText('expenses.v2.recurring.sheetTitle')).toBeTruthy();
        expect(queryByText('common.save')).toBeNull();
    });

    it('selects a frequency and closes', () => {
        const onSelect = jest.fn();
        const onClose = jest.fn();
        const { getByTestId } = render(
            <RecurringFrequencySheet
                visible
                value="monthly"
                onSelect={onSelect}
                onClose={onClose}
            />,
        );
        fireEvent.press(getByTestId('recurring-frequency-weekly'));
        expect(onSelect).toHaveBeenCalledWith('weekly');
        expect(onClose).toHaveBeenCalled();
    });
});
