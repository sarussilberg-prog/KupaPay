import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MemberContributionRow } from '../../../components/balances/MemberContributionRow';

describe('MemberContributionRow', () => {
    it('renders the display name and per-currency paid amounts', () => {
        const { getByText } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[
                    { currency: 'USD', amount: 200 },
                    { currency: 'ILS', amount: 50 },
                ]}
                isLast={false}
                onPress={() => {}}
            />,
        );
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('USD 200.00')).toBeTruthy();
        expect(getByText('ILS 50.00')).toBeTruthy();
    });

    it('renders the empty-state line when there are no amounts', () => {
        const { getByText } = render(
            <MemberContributionRow
                userId="bob"
                name="Bob"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        expect(getByText('balances.noActivityInMode')).toBeTruthy();
    });

    it('uses the testID member-row-<userId>', () => {
        const { getByTestId } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        expect(getByTestId('member-row-alice')).toBeTruthy();
    });

    it('fires onPress when tapped', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                amounts={[]}
                isLast
                onPress={onPress}
            />,
        );
        fireEvent.press(getByTestId('member-row-alice'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders the avatar image when avatarUrl is provided', () => {
        const { getByTestId } = render(
            <MemberContributionRow
                userId="alice"
                name="Alice"
                avatarUrl="https://example.com/alice.png"
                amounts={[]}
                isLast
                onPress={() => {}}
            />,
        );
        // expo-image takes the URL string directly as `source`.
        expect(getByTestId('member-avatar-image').props.source).toBe(
            'https://example.com/alice.png',
        );
    });
});
