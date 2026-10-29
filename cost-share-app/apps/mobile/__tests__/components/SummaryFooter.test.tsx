import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SummaryFooter } from '../../components/groupDetail/SummaryFooter';

jest.mock('../../hooks/useRtlLayout', () => {
    const actual = jest.requireActual('../../hooks/useRtlLayout');
    return {
        ...actual,
        useRtlLayout: jest.fn(() => false),
    };
});

const { useRtlLayout } = jest.requireMock('../../hooks/useRtlLayout') as {
    useRtlLayout: jest.Mock;
};

describe('SummaryFooter', () => {
  beforeEach(() => {
    useRtlLayout.mockReturnValue(false);
  });

  const base = {
    settlementCount: 1,
    onOpenNote: jest.fn(),
    onOpenSettleUp: jest.fn(),
  };

  it('shows pluralized "payments to settle" text when there are open payments', () => {
    const { getByText } = render(<SummaryFooter {...base} settlementCount={1} />);
    expect(getByText(/balances\.paymentsToSettle/i)).toBeTruthy();
  });

  it('shows "No open payments" when there are no open payments', () => {
    const { getByText } = render(
      <SummaryFooter {...base} settlementCount={0} />,
    );
    expect(getByText(/groups\.summary\.noOpenPayments/i)).toBeTruthy();
  });

  it('keeps the settle-up pill enabled when there are no open payments', () => {
    const onOpenSettleUp = jest.fn();
    const { getByTestId } = render(
      <SummaryFooter {...base} settlementCount={0} onOpenSettleUp={onOpenSettleUp} />,
    );
    fireEvent.press(getByTestId('group-detail-settle-up'));
    expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenNote / onOpenSettleUp on tap', () => {
    const onOpenNote = jest.fn();
    const onOpenSettleUp = jest.fn();
    const { getByTestId } = render(
      <SummaryFooter
        {...base}
        onOpenNote={onOpenNote}
        onOpenSettleUp={onOpenSettleUp}
      />,
    );
    fireEvent.press(getByTestId('summary-note-pill'));
    fireEvent.press(getByTestId('group-detail-settle-up'));
    expect(onOpenNote).toHaveBeenCalledTimes(1);
    expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
  });

  it('shows the unread-note dot when noteHasUnread is true', () => {
    const { getByTestId } = render(
      <SummaryFooter settlementCount={0} onOpenNote={jest.fn()} onOpenSettleUp={jest.fn()} noteHasUnread />,
    );
    expect(getByTestId('summary-note-unread-dot')).toBeTruthy();
  });

  it('hides the unread-note dot by default', () => {
    const { queryByTestId } = render(
      <SummaryFooter settlementCount={0} onOpenNote={jest.fn()} onOpenSettleUp={jest.fn()} />,
    );
    expect(queryByTestId('summary-note-unread-dot')).toBeNull();
  });

  it('keeps Note and Settle-up pills grouped in RTL (#234)', () => {
    useRtlLayout.mockReturnValue(true);
    const { getByTestId } = render(
      <SummaryFooter settlementCount={2} onOpenNote={jest.fn()} onOpenSettleUp={jest.fn()} />,
    );
    const pillGroup = getByTestId('summary-pill-group');
    expect(pillGroup.props.style.direction).toBe('ltr');
  });

  it('places the unread dot on the leading corner in RTL', () => {
    useRtlLayout.mockReturnValue(true);
    const { getByTestId } = render(
      <SummaryFooter
        settlementCount={0}
        onOpenNote={jest.fn()}
        onOpenSettleUp={jest.fn()}
        noteHasUnread
      />,
    );
    const dot = getByTestId('summary-note-unread-dot');
    expect(dot.props.style).toEqual(expect.objectContaining({ end: -2 }));
  });
});
