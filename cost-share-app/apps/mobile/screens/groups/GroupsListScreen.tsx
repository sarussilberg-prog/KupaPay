/**
 * GroupsListScreen
 * Main groups list with pull-to-refresh and FAB
 * Uses NativeWind styling only, full i18n support
 */

import React, { useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Group } from '@cost-share/shared';
import { useAppStore } from '../../store';
import { useLoading } from '../../hooks/useLoading';
import { fetchGroups } from '../../services/groups.service';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GroupCard } from '../../components/GroupCard';
import { colors } from '../../theme';

export function GroupsListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isLoading, startLoading, stopLoading } = useLoading();
    const groups = useAppStore((state) => state.groups);
    const [refreshing, setRefreshing] = React.useState(false);

    const loadGroups = useCallback(async () => {
        startLoading();
        await fetchGroups();
        stopLoading();
    }, [startLoading, stopLoading]);

    useEffect(() => {
        void loadGroups();
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchGroups();
        setRefreshing(false);
    }, []);

    const handleGroupPress = useCallback(
        (groupId: string) => {
            navigation.navigate('GroupDetail', { groupId });
        },
        [navigation]
    );

    const handleCreateGroup = useCallback(() => {
        navigation.navigate('CreateGroup');
    }, [navigation]);

    const renderGroup = ({ item }: { item: Group }) => (
        <GroupCard group={item} onPress={handleGroupPress} />
    );

    if (isLoading && groups.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <ScreenHeader
                title={t('groups.title')}
                rightLabel={t('groups.createGroup')}
                onRightPress={handleCreateGroup}
            />

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={renderGroup}
                contentContainerClassName="px-4 pb-4"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <EmptyState
                        iconName="people-outline"
                        title={t('groups.noGroups')}
                        message={t('groups.noGroupsMessage')}
                        actionTitle={t('groups.createGroup')}
                        onAction={handleCreateGroup}
                    />
                }
            />
        </SafeAreaView>
    );
}
