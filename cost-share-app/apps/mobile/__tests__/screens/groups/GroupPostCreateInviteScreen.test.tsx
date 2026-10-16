import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ replace: mockReplace }),
    useRoute: () => ({ params: { groupId: 'g9', groupName: 'BBQ' } }),
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../../hooks/useEnsureGroupInviteToken', () => ({
    useEnsureGroupInviteToken: () => true,
}));

jest.mock('../../../hooks/useInviteLink', () => ({
    useInviteLink: () => ({
        url: 'https://kupa-pay.com/g/tok',
        isReady: true,
        share: jest.fn(),
        rotate: jest.fn(),
    }),
}));

jest.mock('react-native-qrcode-svg', () => () => null);

import { GroupPostCreateInviteScreen } from '../../../screens/groups/GroupPostCreateInviteScreen';

describe('GroupPostCreateInviteScreen', () => {
    beforeEach(() => mockReplace.mockClear());

    it('navigates to group detail when user continues', () => {
        const { getByTestId } = render(<GroupPostCreateInviteScreen />);
        fireEvent.press(getByTestId('group-invite-continue'));
        expect(mockReplace).toHaveBeenCalledWith('Main', {
            screen: 'Groups',
            params: { screen: 'GroupDetail', params: { groupId: 'g9' } },
        });
    });
});
