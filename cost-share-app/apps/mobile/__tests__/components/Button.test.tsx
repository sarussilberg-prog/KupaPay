import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../components/Button';

describe('Button', () => {
    it('renders with the provided title', () => {
        const { getByText } = render(<Button title="Click me" onPress={() => { }} />);
        expect(getByText('Click me')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
        const onPress = jest.fn();
        const { getByText } = render(<Button title="Tap" onPress={onPress} />);
        fireEvent.press(getByText('Tap'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('shows an ActivityIndicator instead of text when loading', () => {
        const { queryByText, UNSAFE_getByType } = render(
            <Button title="Save" onPress={() => { }} loading />
        );
        expect(queryByText('Save')).toBeNull();
        // ActivityIndicator should be present
        const ActivityIndicator = require('react-native').ActivityIndicator;
        expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('does not call onPress when disabled', () => {
        const onPress = jest.fn();
        const { getByText } = render(<Button title="Tap" onPress={onPress} disabled />);
        fireEvent.press(getByText('Tap'));
        expect(onPress).not.toHaveBeenCalled();
    });

    it('marks the touchable as disabled when loading', () => {
        const onPress = jest.fn();
        const { UNSAFE_getByType } = render(
            <Button title="Save" onPress={onPress} loading />
        );
        const TouchableOpacity = require('react-native').TouchableOpacity;
        const touchable = UNSAFE_getByType(TouchableOpacity);
        expect(touchable.props.disabled).toBe(true);
    });

    it.each(['primary', 'secondary', 'outline', 'danger'] as const)(
        'renders the %s variant',
        (variant) => {
            const { getByText } = render(
                <Button title={`Variant ${variant}`} onPress={() => { }} variant={variant} />
            );
            expect(getByText(`Variant ${variant}`)).toBeTruthy();
        }
    );
});
