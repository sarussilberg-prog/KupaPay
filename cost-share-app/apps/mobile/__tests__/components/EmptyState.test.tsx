import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../../components/EmptyState';

describe('EmptyState (#394)', () => {
    it('renders secondary action', () => {
        const onSecondary = jest.fn();
        const { getByText } = render(
            <EmptyState
                title="Empty"
                secondaryActionTitle="Try demo"
                onSecondaryAction={onSecondary}
            />,
        );
        fireEvent.press(getByText('Try demo'));
        expect(onSecondary).toHaveBeenCalled();
    });
});
