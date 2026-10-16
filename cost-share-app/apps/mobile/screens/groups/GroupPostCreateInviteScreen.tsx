/**
 * Full-screen invite step shown immediately after creating a group (skippable).
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GroupInviteSharePanel } from '../../components/invite/GroupInviteSharePanel';

type RouteParams = {
    groupId: string;
    groupName: string;
};

export function GroupPostCreateInviteScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { groupId, groupName } = (route.params ?? {}) as RouteParams;

    const openGroup = useCallback(() => {
        navigation.replace('Main', {
            screen: 'Groups',
            params: { screen: 'GroupDetail', params: { groupId } },
        });
    }, [navigation, groupId]);

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
