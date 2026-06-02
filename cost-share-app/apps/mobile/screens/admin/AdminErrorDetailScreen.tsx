import React, { useCallback } from 'react';
import { View, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { colors } from '../../theme';
import {
    useSentryIssueDetailQuery,
    useSentryIssueEventsQuery,
} from '../../hooks/queries/useAdminSentryQueries';
import type { SentryEventSummary } from '../../services/adminSentry.service';

export function AdminErrorDetailScreen() {
    const { t, i18n } = useTranslation();
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const issueId: string = route.params?.issueId ?? '';

    const detail = useSentryIssueDetailQuery(issueId);
    const events = useSentryIssueEventsQuery(issueId);

    const onRefresh = useCallback(() => {
        void detail.refetch();
        void events.refetch();
    }, [detail, events]);

    const renderEvent = useCallback(
        ({ item }: { item: SentryEventSummary }) => {
            const device = item.tags['device.model'] ?? item.tags['device'] ?? '';
            const os = item.tags['os.version'] ?? item.tags['os'] ?? '';
            const screen = item.tags['routing.route.name'] ?? '';
            const when = item.dateCreated
                ? new Date(item.dateCreated).toLocaleString(i18n.language)
                : '';
            return (
                <TouchableOpacity
                    testID={`admin-error-event-${item.id}`}
                    onPress={() => navigation.navigate('AdminErrorEvent', { event: item })}
                    className="bg-white px-4 py-3 mx-3 mb-2 rounded-xl"
                >
                    <Text className="text-xs text-gray-500">{when}</Text>
                    <Text className="text-sm text-gray-900 mt-0.5">
                        {device}
                        {device && os ? ' · ' : ''}
                        {os}
                    </Text>
                    {screen ? (
                        <Text className="text-xs text-gray-500 mt-0.5">
                            {t('admin.errors.screen')}: {screen}
                        </Text>
                    ) : null}
                </TouchableOpacity>
            );
        },
        [navigation, t, i18n.language],
    );

    const header = detail.data ? (
        <View className="bg-white px-4 py-4 border-b border-gray-100">
            <Text className="text-base font-semibold text-gray-900">{detail.data.title}</Text>
            {detail.data.culprit ? (
                <Text className="text-xs text-gray-500 mt-1">{detail.data.culprit}</Text>
            ) : null}
            <View className="flex-row mt-2 flex-wrap">
                <Text className="text-[11px] text-gray-500 mr-3">
                    {t('admin.errors.level')}: {detail.data.level}
                </Text>
                <Text className="text-[11px] text-gray-500 mr-3">
                    {t('admin.errors.status_label')}: {detail.data.status}
                </Text>
                <Text className="text-[11px] text-gray-500 mr-3">
                    {t('admin.errors.occurrences', { count: Number(detail.data.count) })}
                </Text>
                <Text className="text-[11px] text-gray-500">
                    {t('admin.errors.affectedUsers', { count: detail.data.userCount })}
                </Text>
            </View>
            {detail.data.firstSeen ? (
                <Text className="text-[11px] text-gray-500 mt-1">
                    {t('admin.errors.firstSeen', {
                        when: new Date(detail.data.firstSeen).toLocaleString(i18n.language),
                    })}
                </Text>
            ) : null}
            {detail.data.lastSeen ? (
                <Text className="text-[11px] text-gray-500">
                    {t('admin.errors.lastSeen', {
                        when: new Date(detail.data.lastSeen).toLocaleString(i18n.language),
                    })}
                </Text>
            ) : null}
        </View>
    ) : null;

    if (detail.isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50">
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <FlatList
                data={events.data ?? []}
                keyExtractor={(e) => e.id}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <View className="px-4 py-6">
                        <Text className="text-xs text-gray-500 text-center">
                            {t('admin.errors.noEvents')}
                        </Text>
                    </View>
                }
                renderItem={renderEvent}
                refreshControl={
                    <RefreshControl
                        refreshing={detail.isRefetching || events.isRefetching}
                        onRefresh={onRefresh}
                    />
                }
                contentContainerStyle={{ paddingVertical: 12 }}
            />
        </View>
    );
}
