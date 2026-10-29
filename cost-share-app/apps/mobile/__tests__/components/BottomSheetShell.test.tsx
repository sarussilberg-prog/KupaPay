import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BottomSheetShell } from '../../components/BottomSheetShell';

describe('BottomSheetShell', () => {
    const baseProps = {
        visible: true,
        label: 'SETTLE UP',
        onClose: jest.fn(),
        onSave: jest.fn(),
        saveDisabled: false,
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders the label and children when visible', () => {
        const { getByText } = render(
            <BottomSheetShell {...baseProps}>
                <Text>body</Text>
            </BottomSheetShell>
        );
        expect(getByText('SETTLE UP')).toBeTruthy();
        expect(getByText('body')).toBeTruthy();
    });

    it('calls onClose when Cancel is pressed', () => {
        const onClose = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onClose={onClose}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('common.cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onSave when Save is pressed', () => {
        const onSave = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onSave={onSave}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('common.save'));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('disables Save when saveDisabled is true', () => {
        const onSave = jest.fn();
        const { getByText } = render(
            <BottomSheetShell {...baseProps} onSave={onSave} saveDisabled>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByText('common.save'));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onClose when scrim is tapped', () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <BottomSheetShell {...baseProps} onClose={onClose}>
                <Text>x</Text>
            </BottomSheetShell>
        );
        fireEvent.press(getByTestId('bottom-sheet-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('hides Save when onSave is omitted', () => {
        const { queryByText, getByText } = render(
            <BottomSheetShell visible label="REPEAT" onClose={jest.fn()}>
                <Text>body</Text>
            </BottomSheetShell>
        );
        expect(getByText('REPEAT')).toBeTruthy();
        expect(queryByText('common.save')).toBeNull();
    });
});
