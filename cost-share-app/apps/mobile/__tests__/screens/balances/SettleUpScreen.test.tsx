import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
        useRoute: () => ({
            params: {
                groupId: 'g1',
                fromUserId: 'u1',
                toUserId: 'u2',
                amount: 30,
                currency: 'USD',
            },
        }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/settlements.service', () => ({
    createSettlement: jest.fn(),
}));

import { SettleUpScreen } from '../../../screens/balances/SettleUpScreen';
import { createSettlement } from '../../../services/settlements.service';
import { useAppStore } from '../../../store';

const mockCreate = createSettlement as jest.MockedFunction<typeof createSettlement>;

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockCreate.mockReset();
    useAppStore.setState({
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'A',
            defaultCurrency: 'USD',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
});

describe('SettleUpScreen', () => {
    it('pre-fills the amount from navigation params', () => {
        const { getByDisplayValue } = render(<SettleUpScreen />);
        expect(getByDisplayValue('30')).toBeTruthy();
    });

    it('calls createSettlement with the parsed amount and route params', async () => {
        mockCreate.mockResolvedValueOnce({ id: 's1' } as any);
        const { getByText, getAllByText } = render(<SettleUpScreen />);
        const submits = getAllByText('groups.settleUp');
        fireEvent.press(submits[submits.length - 1]);
        await waitFor(() => expect(mockCreate).toHaveBeenCalled());
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                groupId: 'g1',
                fromUserId: 'u1',
                toUserId: 'u2',
                amount: 30,
                currency: 'USD',
            })
        );
        await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });

    it('shows an invalid-amount error for empty amount', async () => {
        const { getByDisplayValue, getAllByText, findByText } = render(<SettleUpScreen />);
        fireEvent.changeText(getByDisplayValue('30'), '');
        const submits = getAllByText('groups.settleUp');
        fireEvent.press(submits[submits.length - 1]);
        expect(await findByText('expenses.invalidAmount')).toBeTruthy();
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
