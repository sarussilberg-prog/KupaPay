import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DebtPairGroup } from '../../../components/balances/DebtPairGroup';
import { groupDebtsByPair } from '../../../lib/groupDebtsByPair';

const names: Record<string, string> = { me: 'You', alice: 'Alice', bob: 'Bob' };
const nameFor = (id: string) => names[id] ?? id;
const avatarFor = () => undefined;

const renderDebt = (debt: { fromUserId: string; toUserId: string; currency: string }) => (
    <Text testID={`debt-${debt.currency}`} key={debt.currency}>
        {debt.fromUserId}→{debt.toUserId} {debt.currency}
    </Text>
);

function renderGroup(debts: any[], currentUserId = 'me', onRemind?: () => void) {
    const [group] = groupDebtsByPair(debts);
    return render(
        <DebtPairGroup
            group={group}
            involved={debts.some(d => d.fromUserId === currentUserId || d.toUserId === currentUserId)}
            currentUserId={currentUserId}
            nameFor={nameFor}
            avatarFor={avatarFor}
            renderDebt={renderDebt}
            onRemind={onRemind}
        />,
    );
}

describe('DebtPairGroup', () => {
    const multiCurrency = [
        { fromUserId: 'me', toUserId: 'alice', currency: 'USD', amount: 40 },
        { fromUserId: 'me', toUserId: 'alice', currency: 'EUR', amount: 12 },
    ];

    it('renders a collapsed summary row and hides the individual debts initially', () => {
        const { getByText, queryByTestId } = renderGroup(multiCurrency);
        // pluralised count label (i18n mock returns the key + interpolations)
        expect(getByText('settleUp.pairGroupCount')).toBeTruthy();
        expect(queryByTestId('debt-USD')).toBeNull();
        expect(queryByTestId('debt-EUR')).toBeNull();
    });

    it('expands to reveal the individual debt rows on press', () => {
        const { getByTestId, queryByTestId } = renderGroup(multiCurrency);
        fireEvent.press(getByTestId('settle-debt-group-alice|me'));
        expect(getByTestId('debt-USD')).toBeTruthy();
        expect(getByTestId('debt-EUR')).toBeTruthy();
        // pressing again collapses
        fireEvent.press(getByTestId('settle-debt-group-alice|me'));
        expect(queryByTestId('debt-USD')).toBeNull();
    });

    it('shows a one-directional text arrow when every debt flows the same way', () => {
        const { getByText, queryByTestId } = renderGroup(multiCurrency);
        expect(getByText('→')).toBeTruthy();
        expect(queryByTestId('pair-arrow-bidirectional')).toBeNull();
    });

    it('renders a single per-connection reminder button when onRemind is given', () => {
        const onRemind = jest.fn();
        const { getByTestId, getAllByText } = renderGroup(multiCurrency, 'me', onRemind);
        // exactly one reminder affordance, on the group row (not per child)
        expect(getAllByText('remind.sendReminderButton')).toHaveLength(1);
        fireEvent.press(getByTestId('remind-group-alice|me'));
        expect(onRemind).toHaveBeenCalledTimes(1);
    });

    it('omits the reminder button when onRemind is not provided', () => {
        const { queryByTestId } = renderGroup(multiCurrency);
        expect(queryByTestId('remind-group-alice|me')).toBeNull();
    });

    it('shows the bidirectional swap icon when debts flow both ways', () => {
        const { getByTestId, queryByText } = renderGroup([
            { fromUserId: 'me', toUserId: 'alice', currency: 'USD', amount: 40 },
            { fromUserId: 'alice', toUserId: 'me', currency: 'EUR', amount: 12 },
        ]);
        expect(getByTestId('pair-arrow-bidirectional')).toBeTruthy();
        expect(queryByText('→')).toBeNull();
    });
});
