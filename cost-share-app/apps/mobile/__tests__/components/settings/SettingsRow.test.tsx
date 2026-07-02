import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsRow } from '../../../components/settings/SettingsRow';

describe('SettingsRow', () => {
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
