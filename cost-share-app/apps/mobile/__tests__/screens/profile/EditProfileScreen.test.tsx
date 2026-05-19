import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
        useRoute: () => ({ params: {} }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

jest.mock('../../../services/users.service', () => ({
    updateUser: jest.fn(),
}));

import { EditProfileScreen } from '../../../screens/profile/EditProfileScreen';
import { useAppStore } from '../../../store';
import { updateUser } from '../../../services/users.service';

const mockUpdate = updateUser as jest.MockedFunction<typeof updateUser>;

beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockUpdate.mockReset();
    useAppStore.setState({
        currentUser: {
            id: 'u1',
            email: 'a@x.com',
            name: 'Alice',
            phone: '555-1212',
            defaultCurrency: 'USD',
            language: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    });
});

describe('EditProfileScreen', () => {
    it('pre-fills name and phone from currentUser', () => {
        const { getByDisplayValue } = render(<EditProfileScreen />);
        expect(getByDisplayValue('Alice')).toBeTruthy();
        expect(getByDisplayValue('555-1212')).toBeTruthy();
    });

    it('shows nameRequired error when name is cleared', async () => {
        const { getByDisplayValue, getByText, findByText } = render(<EditProfileScreen />);
        fireEvent.changeText(getByDisplayValue('Alice'), '');
        fireEvent.press(getByText('common.save'));
        expect(await findByText('profile.nameRequired')).toBeTruthy();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('calls updateUser with the new values', async () => {
        mockUpdate.mockResolvedValueOnce({ id: 'u1' } as any);
        const { getByDisplayValue, getByText } = render(<EditProfileScreen />);
        fireEvent.changeText(getByDisplayValue('Alice'), 'Bob');
        fireEvent.press(getByText('common.save'));
        await waitFor(() =>
            expect(mockUpdate).toHaveBeenCalledWith(
                'u1',
                expect.objectContaining({ name: 'Bob' })
            )
        );
    });

    it('cancel navigates back', () => {
        const { getByText } = render(<EditProfileScreen />);
        fireEvent.press(getByText('common.cancel'));
        expect(mockGoBack).toHaveBeenCalled();
    });
});
