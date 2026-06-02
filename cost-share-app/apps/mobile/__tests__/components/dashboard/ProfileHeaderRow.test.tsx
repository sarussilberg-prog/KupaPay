import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProfileHeaderRow } from '../../../components/dashboard/ProfileHeaderRow';

describe('ProfileHeaderRow', () => {
    it('renders avatar, name and triggers onEditPress', () => {
        const onEdit = jest.fn();
        const onShare = jest.fn();
        const { getByText, getByTestId, queryByText } = render(
            <ProfileHeaderRow
                name="Alice"
                avatarUrl={undefined}
                onSharePress={onShare}
                onEditPress={onEdit}
            />,
        );
        expect(getByText('Alice')).toBeTruthy();
        expect(getByTestId('profile-header-avatar')).toBeTruthy();
        expect(queryByText('profile.editProfile')).toBeNull();
        fireEvent.press(getByTestId('profile-header-share'));
        expect(onShare).toHaveBeenCalled();
        fireEvent.press(getByTestId('profile-header-edit'));
        expect(onEdit).toHaveBeenCalled();
    });
});
