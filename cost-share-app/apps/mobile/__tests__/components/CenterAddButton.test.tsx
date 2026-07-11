import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CenterAddButton } from '../../components/navigation/CenterAddButton';

describe('CenterAddButton', () => {
    it('renders the add icon and fires onPress', () => {
        const onPress = jest.fn();
        const { getByTestId } = render(<CenterAddButton onPress={onPress} />);
        fireEvent.press(getByTestId('center-add-button'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('exposes an accessibility label from i18n', () => {
        const { getByLabelText } = render(<CenterAddButton onPress={jest.fn()} />);
        // react-i18next is stubbed in jest-setup.ts to return the key.
        expect(getByLabelText('expenses.v2.addQuick')).toBeTruthy();
    });
});
