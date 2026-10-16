import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-qrcode-svg', () => {
    const React = require('react');
    const { View } = require('react-native');
    return function MockQr(props: { value: string }) {
        return <View testID="mock-qr">{props.value}</View>;
    };
});

jest.mock('../../../hooks/useEnsureGroupInviteToken', () => ({
    useEnsureGroupInviteToken: () => true,
}));

const mockShare = jest.fn();
jest.mock('../../../hooks/useInviteLink', () => ({
    useInviteLink: () => ({
        url: 'https://kupa-pay.com/g/inviteTok123',
        isReady: true,
        share: mockShare,
        rotate: jest.fn(),
    }),
}));

jest.mock('../../../services/invite.service', () => ({
    shareGroupInviteViaWhatsApp: jest.fn(),
    copyGroupInviteLink: jest.fn(),
}));

import { GroupInviteSharePanel } from '../../../components/invite/GroupInviteSharePanel';
import {
    copyGroupInviteLink,
    shareGroupInviteViaWhatsApp,
} from '../../../services/invite.service';

describe('GroupInviteSharePanel', () => {
    beforeEach(() => {
        mockShare.mockClear();
        (shareGroupInviteViaWhatsApp as jest.Mock).mockClear();
        (copyGroupInviteLink as jest.Mock).mockClear();
    });

    it('renders QR with invite URL and triggers share actions', async () => {
        const onContinue = jest.fn();
        const onSkip = jest.fn();
        const { getByTestId } = render(
            <GroupInviteSharePanel
                groupId="g1"
                groupName="Trip"
                onContinue={onContinue}
                onSkip={onSkip}
            />,
        );

        expect(getByTestId('mock-qr').props.children).toBe('https://kupa-pay.com/g/inviteTok123');

        fireEvent.press(getByTestId('group-invite-share-sheet'));
        await waitFor(() => expect(mockShare).toHaveBeenCalled());

        fireEvent.press(getByTestId('group-invite-whatsapp'));
        expect(shareGroupInviteViaWhatsApp).toHaveBeenCalledWith('g1');

        fireEvent.press(getByTestId('group-invite-copy-link'));
        expect(copyGroupInviteLink).toHaveBeenCalledWith('g1');

        fireEvent.press(getByTestId('group-invite-skip'));
        expect(onSkip).toHaveBeenCalled();

        fireEvent.press(getByTestId('group-invite-continue'));
        expect(onContinue).toHaveBeenCalled();
    });
});
