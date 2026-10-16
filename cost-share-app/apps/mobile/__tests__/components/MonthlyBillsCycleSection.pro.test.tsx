import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MonthlyBillsCycleSection } from '../../components/groups/MonthlyBillsCycleSection';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const proStatusMock = {
    proPerkUnlocked: false,
};

jest.mock('../../hooks/queries/useProStatusQuery', () => ({
    useProStatusQuery: () => proStatusMock,
}));

describe('MonthlyBillsCycleSection Pro gate', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        proStatusMock.proPerkUnlocked = false;
    });

    const baseProps = {
        groupId: 'g1',
        cycleDay: 1,
        currency: 'ILS',
        expenses: [
            {
                amount: 100,
                currency: 'ILS',
                isDeleted: false,
                expenseDate: new Date('2026-10-05T12:00:00Z'),
            },
        ],
    };

    it('navigates to paywall when Pro is locked', () => {
        const { getByText } = render(<MonthlyBillsCycleSection {...baseProps} />);
        fireEvent.press(getByText('groups.monthlyBills.automationPro'));
        expect(mockNavigate).toHaveBeenCalledWith(
            'Paywall',
            expect.objectContaining({ featureKey: 'recurring' }),
        );
    });

    it('does not show paywall CTA when proPerkUnlocked', () => {
        proStatusMock.proPerkUnlocked = true;
        const { queryByText, getByText } = render(<MonthlyBillsCycleSection {...baseProps} />);
        expect(queryByText('groups.monthlyBills.automationPro')).toBeNull();
        expect(getByText('groups.monthlyBills.automationActive')).toBeTruthy();
    });
});
