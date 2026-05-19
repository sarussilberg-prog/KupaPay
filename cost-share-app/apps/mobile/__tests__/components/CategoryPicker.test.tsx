import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CategoryPicker } from '../../components/CategoryPicker';

describe('CategoryPicker', () => {
    it('renders all category options', () => {
        const { getByText } = render(
            <CategoryPicker value="food" onChange={() => { }} />
        );
        expect(getByText('expenses.categories.food')).toBeTruthy();
        expect(getByText('expenses.categories.transport')).toBeTruthy();
        expect(getByText('expenses.categories.other')).toBeTruthy();
    });

    it('renders the label when provided', () => {
        const { getByText } = render(
            <CategoryPicker value="food" onChange={() => { }} label="Pick one" />
        );
        expect(getByText('Pick one')).toBeTruthy();
    });

    it('invokes onChange with the new category', () => {
        const onChange = jest.fn();
        const { getByText } = render(
            <CategoryPicker value="food" onChange={onChange} />
        );
        fireEvent.press(getByText('expenses.categories.transport'));
        expect(onChange).toHaveBeenCalledWith('transport');
    });
});
