import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScreenHeader } from '../../components/ScreenHeader';

describe('ScreenHeader', () => {
    it('renders the title', () => {
        const { getByText } = render(<ScreenHeader title="Hello" />);
        expect(getByText('Hello')).toBeTruthy();
    });

    it('renders the subtitle when provided', () => {
        const { getByText } = render(
            <ScreenHeader title="Hello" subtitle="World" />
        );
        expect(getByText('World')).toBeTruthy();
    });

    it('renders right action and calls handler when pressed', () => {
        const onRightPress = jest.fn();
        const { getByText } = render(
            <ScreenHeader
                title="Hello"
                rightLabel="Add"
                onRightPress={onRightPress}
            />
        );
        fireEvent.press(getByText('Add'));
        expect(onRightPress).toHaveBeenCalled();
    });

    it('does not render right action when rightLabel is missing', () => {
        const { queryByText } = render(
            <ScreenHeader title="Hello" onRightPress={() => { }} />
        );
        expect(queryByText('Add')).toBeNull();
    });
});
