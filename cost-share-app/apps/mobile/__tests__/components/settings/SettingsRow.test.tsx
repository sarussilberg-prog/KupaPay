import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import ar from '../../../i18n/locales/ar.json';
import de from '../../../i18n/locales/de.json';
import en from '../../../i18n/locales/en.json';
import es from '../../../i18n/locales/es.json';
import fr from '../../../i18n/locales/fr.json';
import he from '../../../i18n/locales/he.json';
import ru from '../../../i18n/locales/ru.json';

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

function flatStyle(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) {
        return Object.assign({}, ...style.filter(Boolean));
    }
    return (style as Record<string, unknown>) ?? {};
}

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
        const row = getByTestId('settings-row-rtl') as { props: { style: unknown[] } };
        const flat = Object.assign({}, ...row.props.style.filter(Boolean));
        expect(flat.gap ?? flat.columnGap).toBe(12);
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

    it('value variant keeps label leading and value adjacent with chevron spacer (LTR)', () => {
        const { getByTestId, getByText } = render(
            <SettingsRow
                iconName="globe-outline"
                label="Language"
                variant="value"
                valueText="English"
                onPress={() => {}}
                testID="settings-value-row"
            />,
        );
        const cluster = getByTestId('settings-value-row-value-cluster');
        const clusterStyle = flatStyle(cluster.props.style);
        expect(clusterStyle.flexGrow).toBe(0);

        const label = getByText('Language');
        expect(label.props.className).not.toContain('flex-1');

        const value = getByTestId('settings-value-row-value');
        expect(value.props.numberOfLines).toBe(1);
        expect(value.props.ellipsizeMode).toBe('tail');
        expect(value.props.className).toContain('text-gray-500');
    });

    it('value variant mirrors cluster layout for Hebrew (RTL)', () => {
        useRtlLayout.mockReturnValue(true);
        const { getByTestId } = render(
            <SettingsRow
                iconName="globe-outline"
                label="שפה"
                variant="value"
                valueText="עברית"
                onPress={() => {}}
                testID="settings-value-row-rtl"
            />,
        );
        const cluster = getByTestId('settings-value-row-rtl-value-cluster');
        const flat = flatStyle(cluster.props.style);
        if (Platform.OS === 'web') {
            expect(flat.direction).toBe('rtl');
        } else {
            expect(flat.flexDirection).toBe('row-reverse');
        }
        expect(getByTestId('settings-value-row-rtl-value').props.children).toBe('עברית');
    });

    it('danger variant renders label', () => {
        const { getByText } = render(<SettingsRow iconName="log-out-outline" label="Log out" variant="danger" onPress={() => {}} />);
        expect(getByText('Log out')).toBeTruthy();
    });

    it.each([
        ['en', en.settings.language, en.profile.english],
        ['he', he.settings.language, he.profile.hebrew],
        ['ar', ar.settings.language, ar.profile.english],
        ['de', de.settings.language, de.profile.english],
        ['es', es.settings.language, es.profile.english],
        ['fr', fr.settings.language, fr.profile.english],
        ['ru', ru.settings.language, ru.profile.english],
    ] as const)('value row renders for locale %s', (_locale, label, valueText) => {
        const { getByText } = render(
            <SettingsRow iconName="globe-outline" label={label} variant="value" valueText={valueText} onPress={() => {}} />,
        );
        expect(getByText(label)).toBeTruthy();
        expect(getByText(valueText)).toBeTruthy();
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
