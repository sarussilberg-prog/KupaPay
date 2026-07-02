import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NotificationsDisabledHint } from '../../../components/settings/NotificationsDisabledHint';
import { openAppNotificationSettings } from '../../../lib/notificationSettings';

jest.mock('../../../lib/notificationSettings', () => ({
    openAppNotificationSettings: jest.fn().mockResolvedValue(undefined),
}));

const mockOpen = openAppNotificationSettings as jest.MockedFunction<typeof openAppNotificationSettings>;

describe('NotificationsDisabledHint', () => {
    beforeEach(() => mockOpen.mockClear());

    it('renders the hint and the go-to-settings link', () => {
        const { getByText, getByTestId } = render(<NotificationsDisabledHint />);
        expect(getByText(/notifications\.systemDisabledHint/)).toBeTruthy();
        expect(getByTestId('notifications-go-to-settings')).toBeTruthy();
    });

    it('opens the app notification settings when the link is pressed', () => {
        const { getByTestId } = render(<NotificationsDisabledHint />);
        fireEvent.press(getByTestId('notifications-go-to-settings'));
        expect(mockOpen).toHaveBeenCalledTimes(1);
    });
});
