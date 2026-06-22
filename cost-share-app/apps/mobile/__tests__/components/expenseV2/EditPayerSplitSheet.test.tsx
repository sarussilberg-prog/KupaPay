import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { EditPayerSplitSheet } from '../../../components/expenseV2/EditPayerSplitSheet';

const members = [
    { id: 'a', name: 'Ari', isActive: true },
    { id: 'b', name: 'Bar', isActive: true },
    { id: 'c', name: 'Cid', isActive: true },
] as any;

function renderSheet(overrides: { onCancel?: () => void; onDone?: (draft: any) => void } = {}) {
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
            onCancel={overrides.onCancel ?? (() => {})}
            onDone={overrides.onDone ?? (() => {})}
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

describe('EditPayerSplitSheet — save vs. discard', () => {
    it('Done commits the draft and closes when the split is valid', () => {
        const onDone = jest.fn();
        const { getByTestId } = renderSheet({ onDone });
        fireEvent.changeText(getByTestId('split-input-a'), '50'); // a=50, b=c=25 → valid
        fireEvent.press(getByTestId('edit-payer-split-done'));
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone.mock.calls[0][0]).toMatchObject({
            payerId: 'a',
            splitMode: 'exact',
            selectedMemberIds: ['a', 'b', 'c'],
        });
    });

    it('tapping outside (scrim) saves when valid', () => {
        const onDone = jest.fn();
        const { getByTestId } = renderSheet({ onDone });
        fireEvent.changeText(getByTestId('split-input-a'), '50');
        fireEvent.press(getByTestId('edit-payer-split-scrim'));
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('Done does NOT close and shows the error when the split is invalid', () => {
        const onDone = jest.fn();
        const { getByTestId } = renderSheet({ onDone });
        // Lock a to 10 → b=c auto-fill to 45 each → sums to 100. Then break it by
        // typing on b so the remainder no longer balances.
        fireEvent.changeText(getByTestId('split-input-a'), '10');
        fireEvent.changeText(getByTestId('split-input-b'), '10');
        fireEvent.changeText(getByTestId('split-input-c'), '10'); // a+b+c = 30 ≠ 100
        fireEvent.press(getByTestId('edit-payer-split-done'));
        expect(onDone).not.toHaveBeenCalled();
        expect(getByTestId('edit-payer-split-error')).toBeTruthy();
    });

    it('tapping outside does NOT save when invalid', () => {
        const onDone = jest.fn();
        const { getByTestId } = renderSheet({ onDone });
        fireEvent.changeText(getByTestId('split-input-a'), '10');
        fireEvent.changeText(getByTestId('split-input-b'), '10');
        fireEvent.changeText(getByTestId('split-input-c'), '10');
        fireEvent.press(getByTestId('edit-payer-split-scrim'));
        expect(onDone).not.toHaveBeenCalled();
    });

    it('Cancel discards the draft and closes', () => {
        const onCancel = jest.fn();
        const onDone = jest.fn();
        const { getByTestId } = renderSheet({ onCancel, onDone });
        fireEvent.changeText(getByTestId('split-input-a'), '50');
        fireEvent.press(getByTestId('edit-payer-split-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onDone).not.toHaveBeenCalled();
    });
});
