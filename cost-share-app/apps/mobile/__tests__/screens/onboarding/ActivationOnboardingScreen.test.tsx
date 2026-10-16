import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';

jest.mock('../../../services/groups.service', () => ({
    createGroup: jest.fn(),
}));
jest.mock('../../../services/expenses.service', () => ({
    createExpense: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => () => null);

jest.mock('../../../hooks/useEnsureGroupInviteToken', () => ({
    useEnsureGroupInviteToken: () => true,
}));

jest.mock('../../../hooks/useInviteLink', () => ({
    useInviteLink: () => ({
        url: 'https://kupa-pay.com/g/tok',
        isReady: true,
        share: jest.fn(),
        rotate: jest.fn(),
    }),
}));

jest.mock('../../../services/invite.service', () => ({
    shareGroupInviteViaWhatsApp: jest.fn(),
    copyGroupInviteLink: jest.fn(),
}));
jest.mock('../../../lib/onboardingStorage', () => ({
    markPostLoginOnboardingComplete: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/productAnalytics', () => ({
    captureProductEvent: jest.fn(),
    trackFirstExpenseAdded: jest.fn(),
    getProductAnalyticsClient: jest.fn(() => null),
}));
jest.mock('../../../lib/invalidateBalanceCaches', () => ({
    invalidateBalanceCaches: jest.fn(),
}));

import { ActivationOnboardingScreen } from '../../../screens/onboarding/ActivationOnboardingScreen';
import { createGroup } from '../../../services/groups.service';
import { createExpense } from '../../../services/expenses.service';
import { markPostLoginOnboardingComplete } from '../../../lib/onboardingStorage';
import { trackFirstExpenseAdded } from '../../../lib/productAnalytics';
import { useAppStore } from '../../../store';

const mockCreateGroup = createGroup as jest.MockedFunction<typeof createGroup>;
const mockCreateExpense = createExpense as jest.MockedFunction<typeof createExpense>;

beforeEach(() => {
    mockCreateGroup.mockReset();
    mockCreateExpense.mockReset();
    (markPostLoginOnboardingComplete as jest.Mock).mockClear();
    (trackFirstExpenseAdded as jest.Mock).mockClear();
    useAppStore.setState({
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            inviteToken: 'alice123456',
            defaultCurrency: 'ILS',
            language: 'en',
            isActive: true,
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
    mockCreateGroup.mockResolvedValue({
        id: 'g1',
        name: 'Weekend trip',
        groupType: 'trip',
        defaultCurrency: 'ILS',
        inviteToken: 'tok1234567',
        createdBy: 'u1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    mockCreateExpense.mockResolvedValue({
        id: 'e1',
        groupId: 'g1',
        description: 'Gas',
        amount: 48,
        currency: 'ILS',
        category: 'transport',
        expenseDate: new Date(),
        paidBy: 'u1',
        createdBy: 'u1',
        splitMode: 'equal',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        splits: [],
    });
});

describe('ActivationOnboardingScreen', () => {
    it('renders template picker and progresses through create → expense → invite', async () => {
        const onDone = jest.fn();
        const { getByTestId, getByText } = renderWithQuery(
            <ActivationOnboardingScreen onDone={onDone} />,
        );

        expect(getByTestId('activation-template-picker')).toBeTruthy();
        expect(getByTestId('activation-group-name')).toBeTruthy();

        fireEvent.press(getByTestId('activation-create-submit'));

        await waitFor(() => {
            expect(mockCreateGroup).toHaveBeenCalledWith(
                expect.objectContaining({
                    groupType: 'trip',
                    name: expect.any(String),
                }),
            );
        });

        expect(getByTestId('activation-expense-description')).toBeTruthy();
        fireEvent.press(getByTestId('activation-expense-submit'));

        await waitFor(() => {
            expect(mockCreateExpense).toHaveBeenCalled();
            expect(trackFirstExpenseAdded).toHaveBeenCalledWith('g1', expect.any(Object));
        });

        expect(getByTestId('activation-invite-step')).toBeTruthy();
        fireEvent.press(getByTestId('group-invite-skip'));

        await waitFor(() => {
            expect(markPostLoginOnboardingComplete).toHaveBeenCalled();
            expect(onDone).toHaveBeenCalled();
        });
    });

    it('switches template presets when a template card is pressed', async () => {
        const { getByTestId } = renderWithQuery(<ActivationOnboardingScreen onDone={jest.fn()} />);
        await act(async () => {
            fireEvent.press(getByTestId('activation-template-roommates'));
        });
        fireEvent.press(getByTestId('activation-create-submit'));
        await waitFor(() => {
            expect(mockCreateGroup).toHaveBeenCalledWith(
                expect.objectContaining({ groupType: 'home' }),
            );
        });
    });
});
