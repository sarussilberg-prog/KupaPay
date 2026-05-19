/**
 * ActivityFeedScreen
 * Combined activity feed of expenses and settlements across all groups
 * Replaces the old HistoryScreen
 * Uses NativeWind styling only, full i18n support
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { RecentActivity } from '@cost-share/shared';
import { useLoading } from '../../hooks/useLoading';
import { apiGet } from '../../services/api';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ActivityItem } from '../../components/ActivityItem';
import { colors } from '../../theme';

export function ActivityFeedScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isLoading, startLoading, stopLoading } = useLoading();

    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadActivity = useCallback(async () => {
        startLoading();
        const response = await apiGet<RecentActivity[]>('/activity');
        if (response.success && response.data) {
            setActivities(
                response.data.sort(
                    (a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime()
                )
            );
        }
        stopLoading();
    }, [startLoading, stopLoading]);

    useEffect(() => {
        void loadActivity();
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        const response = await apiGet<RecentActivity[]>('/activity');
        if (response.success && response.data) {
            setActivities(
                response.data.sort(
                    (a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime()
                )
            );
        }
        setRefreshing(false);
    }, []);

    const handleActivityPress = useCallback(
        (activity: RecentActivity) => {
            if (activity.activityType === 'expense') {
                navigation.navigate('Groups', {
                    screen: 'ExpenseDetail',
                    params: { expenseId: activity.id, groupId: activity.groupId },
                });
            }
        },
        [navigation]
    );

    const renderActivity = ({ item }: { item: RecentActivity }) => (
        <ActivityItem activity={item} onPress={handleActivityPress} />
    );

    if (isLoading && activities.length === 0) {
        return <LoadingIndicator />;
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <ScreenHeader title={t('activity.title')} />

            <FlatList
                data={activities}
                keyExtractor={(item) => `${item.activityType}-${item.id}`}
                renderItem={renderActivity}
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
                        iconName="list-outline"
                        title={t('activity.noActivity')}
                        message={t('activity.noActivityMessage')}
                    />
                }
            />
        </SafeAreaView>
    );
}
