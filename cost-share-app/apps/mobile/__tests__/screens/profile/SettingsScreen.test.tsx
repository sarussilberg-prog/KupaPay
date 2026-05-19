import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../../i18n', () => ({
    changeLanguage: jest.fn().mockResolvedValue(false),
}));

jest.mock('../../../services/auth.service', () => ({
    signOut: jest.fn(),
}));

import { SettingsScreen } from '../../../screens/profile/SettingsScreen';
import { useAppStore } from '../../../store';
import { changeLanguage } from '../../../i18n';
import { signOut } from '../../../services/auth.service';

const mockChangeLanguage = changeLanguage as jest.MockedFunction<typeof changeLanguage>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

beforeEach(() => {
    mockChangeLanguage.mockClear();
    mockSignOut.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useAppStore.setState({ language: 'en' });
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('SettingsScreen', () => {
    it('renders language section and logout button', () => {
        const { getByText } = render(<SettingsScreen />);
        expect(getByText('settings.language')).toBeTruthy();
        expect(getByText('profile.logout')).toBeTruthy();
    });

    it('calls changeLanguage when a language button is pressed', () => {
        const { getByText } = render(<SettingsScreen />);
        fireEvent.press(getByText('profile.hebrew'));
        expect(mockChangeLanguage).toHaveBeenCalledWith('he');
    });

    it('shows logout confirmation dialog when logout is pressed', () => {
        const { getByText } = render(<SettingsScreen />);
        fireEvent.press(getByText('profile.logout'));
        expect(getByText('profile.logoutConfirm')).toBeTruthy();
    });
});
