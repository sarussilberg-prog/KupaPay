import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TripBudgetSheet } from '../../components/budget/TripBudgetSheet';
import { setGroupTripBudget } from '../../services/tripBudget.service';

jest.mock('../../services/tripBudget.service', () => ({
    setGroupTripBudget: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(),
}));

describe('TripBudgetSheet', () => {
    const baseProps = {
        visible: true,
        groupId: 'g1',
        defaultCurrency: 'USD',
        initialAmount: 100,
        initialCurrency: 'USD',
        onClose: jest.fn(),
        onSaved: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses header Save only (no duplicate save button)', () => {
        const { getAllByText, queryByTestId } = render(<TripBudgetSheet {...baseProps} />);
        expect(getAllByText('common.save')).toHaveLength(1);
        expect(queryByTestId('trip-budget-save')).toBeNull();
    });

    it('opens the currency picker from the labeled field', () => {
        const { getByText, getByTestId } = render(<TripBudgetSheet {...baseProps} />);
        fireEvent.press(getByText(/USD/));
        expect(getByTestId('currency-picker-search')).toBeTruthy();
    });

    it('persists budget when header Save is pressed', async () => {
        const onSaved = jest.fn();
        const { getByText, getByTestId } = render(
            <TripBudgetSheet {...baseProps} onSaved={onSaved} />,
        );
        fireEvent.changeText(getByTestId('trip-budget-amount'), '250');
        fireEvent.press(getByText('common.save'));
        await waitFor(() => {
            expect(setGroupTripBudget).toHaveBeenCalledWith('g1', 250, 'USD');
            expect(onSaved).toHaveBeenCalled();
        });
    });
});
