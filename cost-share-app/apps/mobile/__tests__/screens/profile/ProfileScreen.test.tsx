import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            goBack: jest.fn(),
            setOptions: mockSetOptions,
        }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/auth.service', () => ({
    signOut: jest.fn(),
}));

jest.mock('../../../i18n', () => ({
    changeLanguage: jest.fn().mockResolvedValue(false),
}));

import { ProfileScreen } from '../../../screens/profile/ProfileScreen';
import { useAppStore } from '../../../store';

beforeEach(() => {
    mockNavigate.mockClear();
    mockSetOptions.mockClear();
    useAppStore.setState({
        language: 'en',
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            defaultCurrency: 'USD',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
});

describe('ProfileScreen', () => {
    it('renders the user name and email', () => {
        const { getByText } = render(<ProfileScreen />);
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('a@x.com')).toBeTruthy();
    });

    it('sets header settings button that navigates to Settings', () => {
        render(<ProfileScreen />);
        const headerRight = mockSetOptions.mock.calls[0][0].headerRight;
        const { getByTestId } = render(headerRight());
        fireEvent.press(getByTestId('profile-settings-button'));
        expect(mockNavigate).toHaveBeenCalledWith('Settings');
    });

    it('navigates to EditProfile on edit press', () => {
        const { getByText } = render(<ProfileScreen />);
        fireEvent.press(getByText('profile.editProfile'));
        expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
    });
});
