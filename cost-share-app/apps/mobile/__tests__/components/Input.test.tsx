import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../../components/Input';

describe('Input', () => {
    it('renders with placeholder text', () => {
        const { getByPlaceholderText } = render(
            <Input placeholder="Enter name" value="" onChangeText={() => { }} />
        );
        expect(getByPlaceholderText('Enter name')).toBeTruthy();
    });

    it('renders the label when provided', () => {
        const { getByText } = render(
            <Input label="Email" value="" onChangeText={() => { }} />
        );
        expect(getByText('Email')).toBeTruthy();
    });

    it('handles text changes', () => {
        const onChangeText = jest.fn();
        const { getByPlaceholderText } = render(
            <Input placeholder="Type" value="" onChangeText={onChangeText} />
        );
        fireEvent.changeText(getByPlaceholderText('Type'), 'hello');
        expect(onChangeText).toHaveBeenCalledWith('hello');
    });

    it('shows the error message when error prop is provided', () => {
        const { getByText } = render(
            <Input value="" onChangeText={() => { }} error="Required field" />
        );
        expect(getByText('Required field')).toBeTruthy();
    });

    it('does not render an error message when error is empty', () => {
        const { queryByText } = render(
            <Input value="" onChangeText={() => { }} error="" />
        );
        // No error should appear
        expect(queryByText('Required field')).toBeNull();
    });
});
