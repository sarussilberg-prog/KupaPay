import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SmartPaymentReminderSection } from '../../../components/pro/SmartPaymentReminderSection';

jest.mock('../../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
}));

jest.mock('../../../services/smartPaymentReminder.service', () => ({
    fetchGroupSmartReminderInterval: jest.fn().mockResolvedValue(7),
    setGroupSmartReminderInterval: jest.fn(),
}));

const mockNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => mockNavigation,
}));

describe('SmartPaymentReminderSection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows upsell when locked', () => {
        const { getByText } = render(
            <SmartPaymentReminderSection
                groupId="g1"
                groupName="Trip"
                unlocked={false}
                currentUserId="me"
                debts={[]}
                nameById={{}}
            />,
        );
        fireEvent.press(getByText('pro.tripCurrency.upgrade'));
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'Paywall',
            expect.objectContaining({ featureKey: 'smart_payment_reminder' }),
        );
    });

    it('loads interval when unlocked', async () => {
        const { getByText } = render(
            <SmartPaymentReminderSection
                groupId="g1"
                groupName="Trip"
                unlocked
                currentUserId="me"
                debts={[]}
                nameById={{}}
            />,
        );
        await waitFor(() => {
            expect(getByText('pro.smartReminder.every7Days')).toBeTruthy();
        });
    });
});
