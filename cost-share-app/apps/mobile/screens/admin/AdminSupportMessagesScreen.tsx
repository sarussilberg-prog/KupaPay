import React, { useState } from 'react';
import { View, FlatList, RefreshControl, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Text } from '../../components/AppText';
import { useAdminSupportMessagesQuery } from '../../hooks/queries/useAdminSupportMessagesQuery';
import { toDate } from '../../lib/dateUtils';
import { showSuccessMessage } from '../../lib/appToast';
import type { SupportMessage } from '../../services/admin.service';

export function AdminSupportMessagesScreen() {
    const { t } = useTranslation();
    const query = useAdminSupportMessagesQuery();
    const [selected, setSelected] = useState<SupportMessage | null>(null);

    if (!query.isLoading && (query.data ?? []).length === 0) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50 px-8">
                <Text className="text-gray-500 text-center">{t('admin.supportMessages.empty')}</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <FlatList
                data={query.data ?? []}
                keyExtractor={(r) => r.id}
                refreshControl={
                    <RefreshControl
                        refreshing={query.isRefetching}
                        onRefresh={() => void query.refetch()}
                    />
                }
                contentContainerStyle={{ paddingVertical: 12 }}
                renderItem={({ item }) => (
                    <Pressable onPress={() => setSelected(item)}>
                        <View className="bg-white px-4 py-3 mx-3 mb-2 rounded-xl">
                            <View className="flex-row items-center justify-between mb-1">
                                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                                <Text className="text-xs text-gray-400">
                                    {toDate(item.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <Text className="text-xs text-primary mb-2">{item.email}</Text>
                            <Text className="text-sm text-gray-700" numberOfLines={2}>{item.message}</Text>
                        </View>
                    </Pressable>
                )}
            />

            <Modal
                visible={selected !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setSelected(null)}
            >
                <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <View style={styles.handle} />
                        <View style={styles.header}>
                            <Text className="text-base font-semibold text-gray-900">{selected?.name}</Text>
                            <Text className="text-xs text-gray-400 mt-0.5">
                                {selected ? toDate(selected.createdAt).toLocaleDateString() : ''}
                            </Text>
                        </View>
                        <Pressable onPress={() => {
                            if (selected?.email) {
                                void Clipboard.setStringAsync(selected.email).then(() => {
                                    showSuccessMessage('settings.contactEmailCopied');
                                });
                            }
                        }}>
                            <Text className="text-xs text-primary px-5 mb-3">{selected?.email}</Text>
                        </Pressable>
                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}
                            showsVerticalScrollIndicator
                        >
                            <Text className="text-sm text-gray-800 leading-6">{selected?.message}</Text>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        height: '75%',
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#d1d5db',
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 4,
    },
    body: {
        flex: 1,
    },
    bodyContent: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
});
