import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SimplifiedDebtsSection } from '../../../components/balances/SimplifiedDebtsSection';

const nameById = { me: 'Me', alice: 'Alice', bob: 'Bob', carol: 'Carol' };
const avatarById = { me: undefined, alice: undefined, bob: undefined, carol: undefined };

function entry(currency: string, debts: any[], algorithm: 'exact' | 'greedy' = 'exact') {
    return {
        currency,
        result: { debts, transactionCount: debts.length, algorithm },
    };
}

describe('SimplifiedDebtsSection', () => {
    it('renders the "all settled" empty state when there are no debts', () => {
        const { getByText, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(getByText('balances.allSettled')).toBeTruthy();
        expect(queryByTestId('debts-summary')).toBeNull();
    });

    it('shows an offline-unavailable state (NOT "all settled") when balance data is missing', () => {
        const { getByTestId, queryByText } = render(
            <SimplifiedDebtsSection
                entries={[]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                balanceUnknown
                onSettle={() => {}}
            />,
        );
        expect(getByTestId('debts-unavailable')).toBeTruthy();
        expect(queryByText('balances.allSettled')).toBeNull();
    });

    it('renders involved debts directly and hides others behind a toggle', () => {
        const involvedDebt = {
            fromUserId: 'me',
            toUserId: 'alice',
            currency: 'USD',
            amount: 30,
        };
        const otherDebt = {
            fromUserId: 'bob',
            toUserId: 'carol',
            currency: 'USD',
            amount: 50,
        };
        const { getByTestId, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[entry('USD', [involvedDebt, otherDebt])]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        // Involved row is visible immediately.
        expect(getByTestId('settle-debt-me-alice-USD')).toBeTruthy();
        // Non-involved row is hidden until the toggle is pressed.
        expect(queryByTestId('settle-debt-bob-carol-USD')).toBeNull();
        expect(getByTestId('settle-others-toggle')).toBeTruthy();
    });

    it('expands the others list when the toggle is pressed', () => {
        const otherDebt = {
            fromUserId: 'bob',
            toUserId: 'carol',
            currency: 'USD',
            amount: 50,
        };
        const { getByTestId, queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[entry('USD', [otherDebt])]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(queryByTestId('settle-debt-bob-carol-USD')).toBeNull();
        fireEvent.press(getByTestId('settle-others-toggle'));
        expect(getByTestId('settle-debt-bob-carol-USD')).toBeTruthy();
    });

    it('shows the Minimum badge when every currency was solved by the exact algorithm', () => {
        const { getByTestId } = render(
            <SimplifiedDebtsSection
                entries={[
                    entry('USD', [
                        { fromUserId: 'me', toUserId: 'alice', currency: 'USD', amount: 30 },
                    ]),
                ]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(getByTestId('minimum-badge')).toBeTruthy();
    });

    it('hides the Minimum badge when any currency was solved greedily', () => {
        const { queryByTestId } = render(
            <SimplifiedDebtsSection
                entries={[
                    entry(
                        'USD',
                        [
                            {
                                fromUserId: 'me',
                                toUserId: 'alice',
                                currency: 'USD',
                                amount: 30,
                            },
                        ],
                        'greedy',
                    ),
                ]}
                avatarById={avatarById}
                nameById={nameById}
                currentUserId="me"
                onSettle={() => {}}
            />,
        );
        expect(queryByTestId('minimum-badge')).toBeNull();
    });
});
