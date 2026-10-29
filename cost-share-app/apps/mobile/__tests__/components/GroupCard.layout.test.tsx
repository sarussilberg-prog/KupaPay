import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../lib/featureFlags', () => ({
    ...jest.requireActual('../../lib/featureFlags'),
    E2E_MAESTRO_AUTH_ENABLED: true,
}));

import type { GroupWithMembers } from '@cost-share/shared';
import { GroupCard } from '../../components/GroupCard';
import { LayoutWindowWidthProvider } from '../../hooks/useLayoutWindowWidth';
import { groupCardOuterRowStyle, isNativeRowFlexSafe, listRowFlexStyle } from '../../lib/nativeRowLayoutStyle';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn() }),
}));

const baseGroup: GroupWithMembers = {
    id: 'g1',
    name: 'Trip to Paris',
    description: '',
    groupType: 'trip',
    defaultCurrency: 'EUR',
    inviteToken: 'abc1234567',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    members: [{ userId: 'u1', displayName: 'Alice', isActive: true }],
    isArchivedByMe: false,
    isAutoArchived: false,
    hasUnreadNote: false,
};

describe('GroupCard layout (native-like style resolver)', () => {
    const widths = [320, 375, 390, 430, 768] as const;

    it.each(widths)('outer row styles stay full-width and flex-safe at %ipx', width => {
        const os = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
        for (const isRtl of [false, true]) {
            const outer = groupCardOuterRowStyle(isRtl);
            expect(outer.width).toBe('100%');
            expect(isNativeRowFlexSafe(outer)).toBe(true);
            const row = listRowFlexStyle(isRtl);
            expect(isNativeRowFlexSafe(row)).toBe(true);
        }
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    });

    it.each(widths)('renders full-width layout probe at %ipx when E2E probes enabled', async width => {
        const { getByTestId } = render(
            <LayoutWindowWidthProvider width={width}>
                <GroupCard group={baseGroup} onPress={() => {}} />
            </LayoutWindowWidthProvider>,
        );
        const shell = getByTestId('group-card-shell-g1');
        fireEvent(shell, 'layout', {
            nativeEvent: { layout: { width: width - 32, height: 80, x: 16, y: 0 } },
        });
        await waitFor(() => {
            expect(getByTestId('group-card-full-width-ok', { hidden: true })).toBeTruthy();
        });
    });
});
