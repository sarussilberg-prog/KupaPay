import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../../components/EmptyState';

describe('EmptyState', () => {
    it('renders the title and message', () => {
        const { getByText } = render(
            <EmptyState title="No items" message="Nothing here yet" />
        );
        expect(getByText('No items')).toBeTruthy();
        expect(getByText('Nothing here yet')).toBeTruthy();
    });

    it('renders the icon when provided', () => {
        const { getByTestId } = render(
            <EmptyState iconName="people-outline" title="Empty" />
        );
        expect(getByTestId('empty-state-icon')).toBeTruthy();
    });

    it('renders the action button and triggers onAction when pressed', () => {
        const onAction = jest.fn();
        const { getByText } = render(
            <EmptyState
                title="Empty"
                actionTitle="Create"
                onAction={onAction}
            />
        );
        fireEvent.press(getByText('Create'));
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('does not render the action button when actionTitle or onAction is missing', () => {
        const { queryByText } = render(<EmptyState title="Empty" />);
        expect(queryByText('Create')).toBeNull();
    });
});
