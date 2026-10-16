import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsRow } from '../../../components/settings/SettingsRow';

jest.mock('../../../hooks/useRtlLayout', () => {
    const actual = jest.requireActual('../../../hooks/useRtlLayout');
    return {
        ...actual,
        useRtlLayout: jest.fn(() => false),
    };
});

const { useRtlLayout } = jest.requireMock('../../../hooks/useRtlLayout') as {
    useRtlLayout: jest.Mock;
};

describe('SettingsRow', () => {
    beforeEach(() => {
        useRtlLayout.mockReturnValue(false);
    });

    it('uses RTL row direction when app language is Hebrew', () => {
        useRtlLayout.mockReturnValue(true);
        const { getByTestId } = render(
            <SettingsRow
                iconName="globe-outline"
                label="שפה"
                variant="chevron"
                onPress={() => {}}
                testID="settings-row-rtl"
            />,
        );
        const row = getByTestId('settings-row-rtl').children[0] as { props: { style: unknown[] } };
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        expect(flat.gap).toBe(12);
        if (Platform.OS === 'web') {
            expect(flat.direction).toBe('rtl');
        } else {
            expect(flat.flexDirection).toBe('row-reverse');
        }
    });

    it('chevron variant: onPress fires', () => {
        const onPress = jest.fn();
        const { getByText } = render(<SettingsRow iconName="globe-outline" label="Language" variant="chevron" onPress={onPress} />);
        fireEvent.press(getByText('Language'));
        expect(onPress).toHaveBeenCalled();
    });

    it('value variant renders text', () => {
        const { getByText } = render(<SettingsRow iconName="globe-outline" label="Language" variant="value" valueText="English" onPress={() => {}} />);
        expect(getByText('English')).toBeTruthy();
    });

    it('danger variant renders label', () => {
        const { getByText } = render(<SettingsRow iconName="log-out-outline" label="Log out" variant="danger" onPress={() => {}} />);
        expect(getByText('Log out')).toBeTruthy();
    });

    it('disabled: onPress does not fire', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <SettingsRow iconName="notifications-outline" label="Notifications" variant="chevron" onPress={onPress} disabled />,
        );
        fireEvent.press(getByText('Notifications'));
        expect(onPress).not.toHaveBeenCalled();
    });
});
