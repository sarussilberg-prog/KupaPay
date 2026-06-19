import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EditPayerSplitSheet } from '../../../components/expenseV2/EditPayerSplitSheet';

const members = [
    { id: 'a', name: 'Ari', isActive: true },
    { id: 'b', name: 'Bar', isActive: true },
    { id: 'c', name: 'Cid', isActive: true },
] as any;

function renderSheet() {
    return render(
        <EditPayerSplitSheet
            visible
            members={members}
            currentUserId="a"
            currency="ILS"
            totalAmount={100}
            initial={{
                payerId: 'a',
                splitMode: 'exact',
                selectedMemberIds: ['a', 'b', 'c'],
                unequalValues: { a: '', b: '', c: '' },
            }}
            onCancel={() => {}}
            onDone={() => {}}
        />,
    );
}

describe('EditPayerSplitSheet — exact-mode auto-fill', () => {
    it('fills the other members when one exact amount is typed', () => {
        const { getByTestId } = renderSheet();
        fireEvent.changeText(getByTestId('split-input-a'), '60');
        expect(getByTestId('split-input-b').props.value).toBe('20.00');
        expect(getByTestId('split-input-c').props.value).toBe('20.00');
    });

    it('cascades: editing a second member re-fills only the last unlocked one', () => {
        const { getByTestId } = renderSheet();
        fireEvent.changeText(getByTestId('split-input-a'), '60');
        fireEvent.changeText(getByTestId('split-input-b'), '30');
        expect(getByTestId('split-input-a').props.value).toBe('60');
        expect(getByTestId('split-input-b').props.value).toBe('30');
        expect(getByTestId('split-input-c').props.value).toBe('10.00');
    });

    it('enables Done because the auto-filled split always sums to the total', () => {
        const { getByTestId } = renderSheet();
        fireEvent.changeText(getByTestId('split-input-a'), '50');
        // a=50, b=c=25 → sums to 100 → Done is not disabled.
        expect(getByTestId('edit-payer-split-done').props.accessibilityState?.disabled).toBeFalsy();
    });
});
