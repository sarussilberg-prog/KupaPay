import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FeedRowCard, FeedAmountLine } from '../../components/FeedRowCard';
import { FEED_AMOUNT_CURRENCY_WIDTH } from '../../lib/feedAmountLayout';
import { View, StyleSheet } from 'react-native';
import { RtlLayoutProvider } from '../../hooks/useRtlLayout';

jest.mock('../../store', () => ({
    useAppStore: (selector: (state: { language: 'he' | 'en' }) => unknown) =>
        selector({ language: 'he' }),
}));

describe('FeedRowCard', () => {
  const baseProps = {
    thumbnail: <View testID="thumb-stub" />,
    title: 'Sushi on Friday',
    meta: 'Aug 14 · Paid by Sarah',
    amount: 'USD 84.20',
  };

  it('renders title, meta, and amount', () => {
    const { getByText } = render(<FeedRowCard {...baseProps} />);
    expect(getByText('Sushi on Friday')).toBeTruthy();
    expect(getByText('Aug 14 · Paid by Sarah')).toBeTruthy();
    expect(getByText('USD')).toBeTruthy();
    expect(getByText('84.20')).toBeTruthy();
  });

  it('renders the sub-line when provided', () => {
    const { getByText, queryByText, rerender } = render(
      <FeedRowCard {...baseProps} subLine="You lent USD 21.05" />,
    );
    expect(getByText('You lent USD 21.05')).toBeTruthy();
    rerender(<FeedRowCard {...baseProps} />);
    expect(queryByText('You lent USD 21.05')).toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <FeedRowCard {...baseProps} onPress={onPress} testID="card" />,
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps currency amounts LTR with a fixed currency column in Hebrew', () => {
    const { getByText } = render(
      <RtlLayoutProvider>
        <FeedRowCard {...baseProps} subLine="הלווית ILS 21.05" />
      </RtlLayoutProvider>,
    );

    const currency = getByText('USD');
    expect(StyleSheet.flatten(currency.props.style)).toMatchObject({
      writingDirection: 'ltr',
      textAlign: 'left',
      width: FEED_AMOUNT_CURRENCY_WIDTH,
    });
  });

  it('renders a very large amount on one line with a smaller value font', () => {
    const { getByText } = render(
      <FeedAmountLine amount="AFN 1000000.00" className="text-[15px] font-bold" />,
    );
    const value = getByText('1000000.00');
    expect(StyleSheet.flatten(value.props.style)).toMatchObject({
      fontSize: 14,
      flex: 1,
      minWidth: 0,
    });
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.adjustsFontSizeToFit).toBe(true);
  });

  it('applies amountClassName to the amount when provided', () => {
    const { getByText } = render(
      <FeedRowCard {...baseProps} amountClassName="text-green-600" />,
    );
    const value = getByText('84.20');
    expect(value.props.className).toContain('text-green-600');
  });

  it('defaults the amount to text-gray-900 when no amountClassName is given', () => {
    const { getByText } = render(<FeedRowCard {...baseProps} />);
    const value = getByText('84.20');
    expect(value.props.className).toContain('text-gray-900');
  });
});
