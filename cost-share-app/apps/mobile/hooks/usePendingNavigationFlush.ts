/**
 * Applies pendingNavigation set during invite redeem outside NavigationContainer.
 */

import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store';

export function usePendingNavigationFlush(): void {
    const navigation = useNavigation() as any;
    const pendingNavigation = useAppStore(s => s.pendingNavigation);
    const setPendingNavigation = useAppStore(s => s.setPendingNavigation);

    useEffect(() => {
        if (!pendingNavigation) return;
        setPendingNavigation(null);
        if (pendingNavigation.target === 'friends') {
            navigation.navigate('Profile', { screen: 'Friends' });
            return;
        }
        if (pendingNavigation.target === 'groupDetail') {
            navigation.navigate('Groups', {
                screen: 'GroupDetail',
                params: { groupId: pendingNavigation.groupId },
            });
            return;
        }
        if (pendingNavigation.target === 'settleUpList') {
            // Open settle-up ON TOP of the group (via GroupDetail + openSettleUp)
            // so Back returns to the relevant group — same pattern as note deep
            // links. GroupDetail pushes SettleUpList on top of itself.
            navigation.navigate('Groups', {
                screen: 'GroupDetail',
                params: { groupId: pendingNavigation.groupId, openSettleUp: true },
            });
            return;
        }
        if (pendingNavigation.target === 'groupsList') {
            navigation.navigate('Groups', { screen: 'GroupsList', merge: true });
        }
    }, [pendingNavigation, navigation, setPendingNavigation]);
}
