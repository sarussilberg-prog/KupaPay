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
        const { getByTestId, queryByTestId } = render(
            <GroupCardMetaLine
                group={baseGroup(new Date())}
                memberCount={1}
                language="en"
            />,
        );
        expect(getByTestId('group-card-meta')).toBeTruthy();
        expect(queryByTestId('group-card-meta-updated')).toBeNull();
    });

    it('appends compact updated time when activity is older than threshold', () => {
        const old = new Date(Date.now() - GROUP_CARD_UPDATED_META_MIN_AGE_MS - 86_400_000);
        const { getByTestId } = render(
            <GroupCardMetaLine group={baseGroup(old)} memberCount={2} language="en" />,
        );
        expect(getByTestId('group-card-meta-updated')).toBeTruthy();
    });

    it('uses full Hebrew relative day labels on the meta line', () => {
        const sixDaysAgo = new Date(Date.now() - GROUP_CARD_UPDATED_META_MIN_AGE_MS - 6 * 86_400_000);
        const { getByTestId } = render(
            <GroupCardMetaLine group={baseGroup(sixDaysAgo)} memberCount={2} language="he" />,
        );
        const updated = getByTestId('group-card-meta-updated');
        expect(String(updated.props.children)).toContain('לפני');
        expect(String(updated.props.children)).not.toMatch(/י׳/);
        expect(String(updated.props.children)).toMatch(/6/);
    });

    it('does not shrink the updated-time segment when space is tight', () => {
        const sixDaysAgo = new Date(Date.now() - GROUP_CARD_UPDATED_META_MIN_AGE_MS - 6 * 86_400_000);
        const { getByTestId } = render(
            <GroupCardMetaLine group={baseGroup(sixDaysAgo)} memberCount={2} language="he" />,
        );
        const style = getByTestId('group-card-meta-updated').props.style;
        const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
        expect(flat.flexShrink).toBe(0);
    });
});
