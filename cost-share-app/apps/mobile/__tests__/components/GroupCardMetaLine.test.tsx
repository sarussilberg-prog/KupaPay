import React from 'react';
import { render } from '@testing-library/react-native';
import type { GroupWithMembers } from '@cost-share/shared';
import {
    GROUP_CARD_UPDATED_META_MIN_AGE_MS,
    GroupCardMetaLine,
} from '../../components/GroupCardMetaLine';

const baseGroup = (lastActivityAt: Date): GroupWithMembers => ({
    id: 'g1',
    name: 'Trip',
    groupType: 'trip',
    defaultCurrency: 'USD',
    inviteToken: 'tok',
    createdBy: 'u1',
    isActive: true,
    createdAt: lastActivityAt,
    updatedAt: lastActivityAt,
    lastActivityAt,
    members: [{ userId: 'u1', displayName: 'A', isActive: true }],
    isArchivedByMe: false,
    isAutoArchived: false,
    hasUnreadNote: false,
});

describe('GroupCardMetaLine', () => {
    it('shows only member count when activity is very recent', () => {
        const { getByTestId, queryByText } = render(
            <GroupCardMetaLine
                group={baseGroup(new Date())}
                memberCount={1}
                language="en"
            />,
        );
        expect(getByTestId('group-card-meta')).toBeTruthy();
        expect(queryByText(/groups\.card\.updatedAgo/)).toBeNull();
    });

    it('appends updated ago when activity is older than threshold', () => {
        const old = new Date(Date.now() - GROUP_CARD_UPDATED_META_MIN_AGE_MS - 86_400_000);
        const { getByText } = render(
            <GroupCardMetaLine group={baseGroup(old)} memberCount={2} language="en" />,
        );
        expect(getByText(/groups\.card\.updatedAgo/)).toBeTruthy();
    });
});
