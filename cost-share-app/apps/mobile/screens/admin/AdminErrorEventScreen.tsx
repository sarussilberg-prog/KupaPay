import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import type { SentryEventSummary } from '../../services/adminSentry.service';

export function AdminErrorEventScreen() {
    const { t, i18n } = useTranslation();
    const route = useRoute<any>();
    const event: SentryEventSummary | null = route.params?.event ?? null;

    if (!event) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50 px-8">
                <Text className="text-gray-500 text-center">{t('admin.errors.noEvents')}</Text>
            </View>
        );
    }

    const tagEntries = Object.entries(event.tags);
    const stackLine = event.exception?.topFrame ?? null;

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="bg-white px-4 py-4 mx-3 mt-3 rounded-xl">
                <Text className="text-[11px] text-gray-500">{t('admin.errors.eventTimestamp')}</Text>
                <Text className="text-sm text-gray-900 mt-0.5">
                    {event.dateCreated ? new Date(event.dateCreated).toLocaleString(i18n.language) : '—'}
                </Text>
            </View>

            <View className="bg-white px-4 py-4 mx-3 mt-3 rounded-xl">
                <Text className="text-[11px] text-gray-500 mb-2">{t('admin.errors.stackTrace')}</Text>
                {event.exception ? (
                    <>
                        <Text className="text-sm text-gray-900">
                            {event.exception.type ?? ''}
                            {event.exception.type && event.exception.value ? ': ' : ''}
                            {event.exception.value ?? ''}
                        </Text>
                        {stackLine ? (
                            <Text
                                className="text-xs text-gray-700 mt-2"
                                style={{ fontFamily: 'Courier' }}
                            >
                                {stackLine}
                            </Text>
                        ) : (
                            <Text className="text-xs text-gray-500 mt-2">
                                {t('admin.errors.noStack')}
                            </Text>
                        )}
                    </>
                ) : (
                    <Text className="text-xs text-gray-500">{t('admin.errors.noStack')}</Text>
                )}
            </View>

            <View className="bg-white px-4 py-4 mx-3 mt-3 rounded-xl">
                <Text className="text-[11px] text-gray-500 mb-2">{t('admin.errors.tags')}</Text>
                {tagEntries.length === 0 ? (
                    <Text className="text-xs text-gray-500">—</Text>
                ) : (
                    tagEntries.map(([k, v]) => (
                        <View key={k} className="flex-row mb-1">
                            <Text className="text-xs text-gray-600 mr-2" style={{ minWidth: 120 }}>
                                {k}
                            </Text>
                            <Text className="text-xs text-gray-900 flex-1">{v}</Text>
                        </View>
                    ))
                )}
            </View>

            <View className="bg-white px-4 py-4 mx-3 mt-3 mb-6 rounded-xl">
                <Text className="text-[11px] text-gray-500 mb-2">{t('admin.errors.user')}</Text>
                {event.user ? (
                    <>
                        {event.user.id ? (
                            <Text className="text-xs text-gray-900">id: {event.user.id}</Text>
                        ) : null}
                        {event.user.email ? (
                            <Text className="text-xs text-gray-900">email: {event.user.email}</Text>
                        ) : null}
                        {event.user.username ? (
                            <Text className="text-xs text-gray-900">
                                username: {event.user.username}
                            </Text>
                        ) : null}
                    </>
                ) : (
                    <Text className="text-xs text-gray-500">—</Text>
                )}
            </View>
        </ScrollView>
    );
}
