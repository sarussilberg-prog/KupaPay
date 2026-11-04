import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

jest.mock('react-native-calendars', () => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');
    // Stub Calendar — exposes onDayPress as tappable buttons keyed by date string
    function Calendar(props: any) {
        const fire = (dateString: string) =>
            props.onDayPress?.({
                dateString,
                day: Number(dateString.slice(8, 10)),
                month: Number(dateString.slice(5, 7)),
                year: Number(dateString.slice(0, 4)),
                timestamp: 0,
            });
        return (
            <View testID="mock-calendar">
                <Text testID="mock-calendar-current">{props.current}</Text>
                <Pressable testID="mock-day-2026-06-15" onPress={() => fire('2026-06-15')}>
                    <Text>tap-day</Text>
                </Pressable>
                <Pressable testID="mock-day-2025-01-01" onPress={() => fire('2025-01-01')}>
                    <Text>tap-other</Text>
                </Pressable>
            </View>
        );
    }
    return { Calendar, LocaleConfig: { locales: {}, defaultLocale: 'en' } };
});

import { DatePickerPopup } from '../../../components/expenseV2/DatePickerPopup';
import { RtlLayoutProvider } from '../../../hooks/useRtlLayout';

function renderPopup(props: React.ComponentProps<typeof DatePickerPopup>) {
    return render(
        <RtlLayoutProvider>
            <DatePickerPopup {...props} />
        </RtlLayoutProvider>,
    );
}

describe('DatePickerPopup', () => {
    it('renders nothing when visible=false', () => {
        const { queryByTestId } = renderPopup({
            visible: false,
            initialDate: new Date(2026, 4, 25),
            onCancel: jest.fn(),
            onConfirm: jest.fn(),
        });
        expect(queryByTestId('date-picker-popup')).toBeNull();
    });

    it('opens with the initial date highlighted', () => {
        const { getByTestId } = renderPopup({
            visible: true,
            initialDate: new Date(2026, 4, 25),
            onCancel: jest.fn(),
            onConfirm: jest.fn(),
        });
        expect(getByTestId('date-picker-popup')).toBeTruthy();
        expect(getByTestId('mock-calendar-current').props.children).toBe('2026-05-25');
    });

    it('calls onConfirm with the picked date when Done is pressed', () => {
        const onConfirm = jest.fn();
        const { getByTestId } = renderPopup({
            visible: true,
            initialDate: new Date(2026, 4, 25),
            onCancel: jest.fn(),
            onConfirm,
        });
        fireEvent.press(getByTestId('mock-day-2026-06-15'));
        fireEvent.press(getByTestId('date-picker-done'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        const arg = onConfirm.mock.calls[0][0] as Date;
        expect(arg.getFullYear()).toBe(2026);
        expect(arg.getMonth()).toBe(5); // June
        expect(arg.getDate()).toBe(15);
    });

    it('calls onConfirm with the initial date if user taps Done without changing the day', () => {
        const onConfirm = jest.fn();
        const { getByTestId } = renderPopup({
            visible: true,
            initialDate: new Date(2026, 4, 25),
            onCancel: jest.fn(),
            onConfirm,
        });
        fireEvent.press(getByTestId('date-picker-done'));
        const arg = onConfirm.mock.calls[0][0] as Date;
        expect(arg.getFullYear()).toBe(2026);
        expect(arg.getMonth()).toBe(4);
        expect(arg.getDate()).toBe(25);
    });

    it('calls onCancel and not onConfirm when Cancel is pressed', () => {
        const onCancel = jest.fn();
        const onConfirm = jest.fn();
        const { getByTestId } = renderPopup({
            visible: true,
            initialDate: new Date(2026, 4, 25),
            onCancel,
            onConfirm,
        });
        fireEvent.press(getByTestId('mock-day-2026-06-15'));
        fireEvent.press(getByTestId('date-picker-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('resets the highlighted day when reopened with a new initialDate', () => {
        const { getByTestId, rerender } = renderPopup({
            visible: false,
            initialDate: new Date(2026, 4, 25),
            onCancel: jest.fn(),
            onConfirm: jest.fn(),
        });
        rerender(
            <RtlLayoutProvider>
                <DatePickerPopup
                    visible
                    initialDate={new Date(2026, 4, 25)}
                    onCancel={jest.fn()}
                    onConfirm={jest.fn()}
                />
            </RtlLayoutProvider>,
        );
        // user picks a different day but cancels
        fireEvent.press(getByTestId('mock-day-2025-01-01'));
        rerender(
            <RtlLayoutProvider>
                <DatePickerPopup
                    visible={false}
                    initialDate={new Date(2026, 4, 25)}
                    onCancel={jest.fn()}
                    onConfirm={jest.fn()}
                />
            </RtlLayoutProvider>,
        );
        // reopen with a different initial
        rerender(
            <RtlLayoutProvider>
                <DatePickerPopup
                    visible
                    initialDate={new Date(2024, 6, 4)}
                    onCancel={jest.fn()}
                    onConfirm={jest.fn()}
                />
            </RtlLayoutProvider>,
        );
        expect(getByTestId('mock-calendar-current').props.children).toBe('2024-07-04');
    });
});
