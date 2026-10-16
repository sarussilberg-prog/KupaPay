import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithQuery } from '../../helpers/renderWithQuery';
import { ActivationTemplatePicker } from '../../../components/activation/ActivationTemplatePicker';

describe('ActivationTemplatePicker', () => {
    it('renders four templates and notifies selection', () => {
        const onSelect = jest.fn();
        const { getByTestId } = renderWithQuery(
            <ActivationTemplatePicker selectedId="trip" onSelect={onSelect} />,
        );
        expect(getByTestId('activation-template-trip')).toBeTruthy();
        expect(getByTestId('activation-template-couple')).toBeTruthy();
        fireEvent.press(getByTestId('activation-template-event'));
        expect(onSelect).toHaveBeenCalledWith('event');
    });
});
