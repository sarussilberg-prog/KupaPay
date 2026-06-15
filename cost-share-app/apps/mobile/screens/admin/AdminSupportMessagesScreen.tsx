import React, { useState, useCallback } from 'react';
import { View, FlatList, RefreshControl, Modal, Pressable, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { Text } from '../../components/AppText';
import { useAdminSupportMessagesQuery } from '../../hooks/queries/useAdminSupportMessagesQuery';
import { toDate } from '../../lib/dateUtils';
import { showSuccessMessage } from '../../lib/appToast';
import { updateSupportMessageStatus, type SupportMessage } from '../../services/admin.service';

export function AdminSupportMessagesScreen() {
    const { t } = useTranslation();
    const query = useAdminSupportMessagesQuery();
    const [selected, setSelected] = useState<SupportMessage | null>(null);
    const [toggling, setToggling] = useState(false);

    const handleToggleStatus = useCallback(async () => {
        if (!selected || toggling) return;
        const next = selected.status === 'open' ? 'closed' : 'open';
        setToggling(true);
        try {
            const ok = await updateSupportMessageStatus(selected.id, next);
            if (ok) {
                setSelected(null);
                void query.refetch();
            }
        } finally {
            setToggling(false);
        }
    }, [selected, toggling, query]);

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
                                <View style={[styles.badge, item.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                                    <Text style={[styles.badgeText, item.status === 'open' ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                                        {item.status === 'open' ? t('admin.supportMessages.statusOpen') : t('admin.supportMessages.statusClosed')}
                                    </Text>
                                </View>
                            </View>
                            <Text className="text-xs text-gray-400 mb-1">{toDate(item.createdAt).toLocaleDateString()}</Text>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text className="text-base font-semibold text-gray-900">{selected?.name}</Text>
                                <Text className="text-xs text-gray-400">
                                    {selected ? toDate(selected.createdAt).toLocaleDateString() : ''}
                                </Text>
                            </View>
                        </View>
                        <Pressable onPress={() => {
                            if (selected?.email) {
                                void Clipboard.setStringAsync(selected.email).then(() => {
                                    showSuccessMessage('settings.contactEmailCopied');
                                });
                            }
                        }}>
                            <Text className="text-xs text-primary px-5 mb-4">{selected?.email}</Text>
                        </Pressable>
                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}
                            showsVerticalScrollIndicator
                        >
                            <Text className="text-sm text-gray-800 leading-6">{selected?.message}</Text>
                        </ScrollView>
                        <TouchableOpacity
                            onPress={() => void handleToggleStatus()}
                            disabled={toggling}
                            style={[styles.toggleBtn, selected?.status === 'open' ? styles.toggleBtnOpen : styles.toggleBtnClosed]}
                        >
                            <Text style={styles.toggleBtnText}>
                                {selected?.status === 'open'
                                    ? t('admin.supportMessages.markClosed')
                                    : t('admin.supportMessages.markOpen')}
                            </Text>
                        </TouchableOpacity>
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
        paddingBottom: 16,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
    },
    badgeOpen: {
        backgroundColor: '#fee2e2',
    },
    badgeClosed: {
        backgroundColor: '#dcfce7',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    badgeTextOpen: {
        color: '#dc2626',
    },
    badgeTextClosed: {
        color: '#16a34a',
    },
    toggleBtn: {
        marginHorizontal: 20,
        marginBottom: 24,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    toggleBtnOpen: {
        backgroundColor: '#16a34a',
    },
    toggleBtnClosed: {
        backgroundColor: '#dc2626',
    },
    toggleBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 15,
        textAlign: 'center',
    },
});
