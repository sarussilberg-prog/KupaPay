/**
 * Full-screen invite step shown immediately after creating a group (skippable).
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { GroupInviteSharePanel } from '../../components/invite/GroupInviteSharePanel';
import { useRequiredRouteParams } from '../../hooks/useRequiredRouteParams';
import { RouteParamsFallback } from '../../components/RouteParamsFallback';

export function GroupPostCreateInviteScreen() {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { isValid, required } = useRequiredRouteParams(['groupId', 'groupName'] as const);
    const groupId = required?.groupId ?? '';
    const groupName = required?.groupName ?? '';

    const openGroup = useCallback(() => {
        navigation.replace('Main', {
            screen: 'Groups',
            params: { screen: 'GroupDetail', params: { groupId } },
        });
    }, [navigation, groupId]);

    if (!isValid) {
        return <RouteParamsFallback />;
    }

    return (
        <View
            className="flex-1 bg-slate-50"
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
            testID="group-post-create-invite-screen"
        >
            <GroupInviteSharePanel
                groupId={groupId}
                groupName={groupName}
                onContinue={openGroup}
                onSkip={openGroup}
            />
        </View>
    );
}
