import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StatTile } from '../../../components/dashboard/StatTile';

describe('StatTile', () => {
    it('renders label + value and triggers onPress', () => {
        const onPress = jest.fn();
        const { getByText } = render(<StatTile iconName="people-outline" label="Active" value={3} onPress={onPress} />);
        expect(getByText('Active')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        fireEvent.press(getByText('3'));
        expect(onPress).toHaveBeenCalled();
    });
});
