import React from 'react';
import { I18nManager } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SummaryFooter } from '../../components/groupDetail/SummaryFooter';
import { RtlLayoutProvider } from '../../hooks/useRtlLayout';
import { useAppStore } from '../../store';

function renderFooter(
    props: React.ComponentProps<typeof SummaryFooter>,
    language: 'en' | 'he' = 'en',
) {
    useAppStore.setState({ language });
    (I18nManager as unknown as { isRTL: boolean }).isRTL = language === 'he';
    return render(
        <RtlLayoutProvider>{<SummaryFooter {...props} />}</RtlLayoutProvider>,
    );
}

function flatStyle(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
    }
    return (style as Record<string, unknown>) ?? {};
}

describe('SummaryFooter', () => {
    afterEach(() => {
        useAppStore.setState({ language: 'en' });
        (I18nManager as unknown as { isRTL: boolean }).isRTL = false;
    });

    const base = {
        settlementCount: 1,
        onOpenNote: jest.fn(),
        onOpenSettleUp: jest.fn(),
    };

    it('shows pluralized "payments to settle" text when there are open payments', () => {
        const { getByText } = renderFooter({ ...base, settlementCount: 1 });
        expect(getByText(/balances\.paymentsToSettle/i)).toBeTruthy();
    });

    it('shows "No open payments" when there are no open payments', () => {
        const { getByText } = renderFooter({ ...base, settlementCount: 0 });
        expect(getByText(/groups\.summary\.noOpenPayments/i)).toBeTruthy();
    });

    it('keeps the settle-up pill enabled when there are no open payments', () => {
        const onOpenSettleUp = jest.fn();
        const { getByTestId } = renderFooter({
            ...base,
            settlementCount: 0,
            onOpenSettleUp,
        });
        fireEvent.press(getByTestId('group-detail-settle-up'));
        expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenNote / onOpenSettleUp on tap', () => {
        const onOpenNote = jest.fn();
        const onOpenSettleUp = jest.fn();
        const { getByTestId } = renderFooter({
            ...base,
            onOpenNote,
            onOpenSettleUp,
        });
        fireEvent.press(getByTestId('summary-note-pill'));
        fireEvent.press(getByTestId('group-detail-settle-up'));
        expect(onOpenNote).toHaveBeenCalledTimes(1);
        expect(onOpenSettleUp).toHaveBeenCalledTimes(1);
    });

    it('shows the unread-note dot when noteHasUnread is true', () => {
        const { getByTestId } = renderFooter({
            settlementCount: 0,
            onOpenNote: jest.fn(),
            onOpenSettleUp: jest.fn(),
            noteHasUnread: true,
        });
        expect(getByTestId('summary-note-unread-dot')).toBeTruthy();
    });

    it('hides the unread-note dot by default', () => {
        const { queryByTestId } = renderFooter({
            settlementCount: 0,
            onOpenNote: jest.fn(),
            onOpenSettleUp: jest.fn(),
        });
        expect(queryByTestId('summary-note-unread-dot')).toBeNull();
    });

    it('keeps Note and Settle-up pills grouped in RTL (#234)', () => {
        const { getByTestId } = renderFooter(
            {
                settlementCount: 2,
                onOpenNote: jest.fn(),
                onOpenSettleUp: jest.fn(),
            },
            'he',
        );
        const pillGroup = getByTestId('summary-pill-group');
        const flat = flatStyle(pillGroup.props.style);
        expect(flat.flexDirection).toBe('row');
        expect(flat.direction).toBeUndefined();
    });

    it('places the unread dot on the leading corner in RTL', () => {
        const { getByTestId } = renderFooter(
            {
                settlementCount: 0,
                onOpenNote: jest.fn(),
                onOpenSettleUp: jest.fn(),
                noteHasUnread: true,
            },
            'he',
        );
        const dot = getByTestId('summary-note-unread-dot');
        expect(dot.props.style).toEqual(expect.objectContaining({ end: -2 }));
    });
});
