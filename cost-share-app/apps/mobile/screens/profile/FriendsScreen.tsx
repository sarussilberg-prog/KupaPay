/**
 * FriendsScreen — incoming requests + friends list.
 * Long-press a friend row to remove.
 */

import React, { useCallback, useState } from 'react';
import {
    View,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Text } from '../../components/AppText';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AppIcon } from '../../components/AppIcon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { colors } from '../../theme';
import {
    useAcceptFriendRequestMutation,
    useFriendsQuery,
    useIncomingFriendRequestsQuery,
    useRejectFriendRequestMutation,
    useRemoveFriendMutation,
} from '../../hooks/queries/useFriendsQueries';
import { User } from '@cost-share/shared';
import { FriendRequest } from '../../services/friends.service';
import { shareFriendInvite } from '../../services/invite.service';

export function FriendsScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const friendsQ = useFriendsQuery();
    const incomingQ = useIncomingFriendRequestsQuery();
    const acceptM = useAcceptFriendRequestMutation();
    const rejectM = useRejectFriendRequestMutation();
    const removeM = useRemoveFriendMutation();

    const [confirmRemove, setConfirmRemove] = useState<User | null>(null);

    const refreshing = friendsQ.isRefetching || incomingQ.isRefetching;
    const onRefresh = useCallback(() => {
        void friendsQ.refetch();
        void incomingQ.refetch();
    }, [friendsQ, incomingQ]);

    const handleAccept = useCallback(
        async (req: FriendRequest) => {
            try {
                await acceptM.mutateAsync(req.id);
                Toast.show({ type: 'success', text1: t('friends.toasts.accepted') });
            } catch {
                Toast.show({ type: 'error', text1: t('friends.toasts.error') });
            }
        },
        [acceptM, t],
    );

    const handleReject = useCallback(
        async (req: FriendRequest) => {
            try {
                await rejectM.mutateAsync(req.id);
                Toast.show({ type: 'success', text1: t('friends.toasts.rejected') });
            } catch {
                Toast.show({ type: 'error', text1: t('friends.toasts.error') });
            }
        },
        [rejectM, t],
    );

    const handleRemoveConfirmed = useCallback(async () => {
        if (!confirmRemove) return;
        const friend = confirmRemove;
        setConfirmRemove(null);
        try {
            await removeM.mutateAsync(friend.id);
            Toast.show({ type: 'success', text1: t('friends.toasts.removed') });
        } catch {
            Toast.show({ type: 'error', text1: t('friends.toasts.error') });
        }
    }, [confirmRemove, removeM, t]);

    const incoming = incomingQ.data ?? [];
    const friends = friendsQ.data ?? [];

    return (
        <View className="flex-1 bg-slate-50">
            <ScrollView
                contentContainerStyle={{ paddingVertical: 12 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Invite CTA */}
                <TouchableOpacity
                    onPress={() => {
                        void shareFriendInvite();
                    }}
                    activeOpacity={0.7}
                    className="mx-4 mt-4 mb-2 px-4 py-3 bg-primary/10 rounded-xl flex-row items-center"
                    testID="friends-invite-cta"
                >
                    <AppIcon name="person-add-outline" size={22} color={colors.primary} />
                    <View className="flex-1 ml-3">
                        <Text className="text-sm font-semibold text-gray-800">
                            {t('invite.friend.title')}
                        </Text>
                        <Text className="text-xs text-slate-500">
                            {t('invite.friend.subtitle')}
                        </Text>
                    </View>
                    <AppIcon name="chevron-forward" size={18} color={colors.gray400} />
                </TouchableOpacity>

                {/* Incoming requests */}
                <View className="px-4 mb-4">
                    <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        {t('friends.incomingRequests')}
                    </Text>
                    {incomingQ.isLoading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : incoming.length === 0 ? (
                        <Text className="text-sm text-gray-500">{t('friends.noIncoming')}</Text>
                    ) : (
                        <View className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                            {incoming.map((req, idx) => (
                                <View
                                    key={req.id}
                                    className={`flex-row items-center px-3 py-3 ${
                                        idx < incoming.length - 1 ? 'border-b border-slate-100' : ''
                                    }`}
                                >
                                    <MemberAvatar
                                        name={req.profile?.name ?? '?'}
                                        avatarUrl={req.profile?.avatarUrl}
                                        size="sm"
                                    />
                                    <Text className="flex-1 ml-3 text-sm font-medium text-gray-800">
                                        {req.profile?.name ?? '?'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleReject(req)}
                                        className="h-9 px-3 rounded-lg border border-gray-200 items-center justify-center mr-2"
                                        accessibilityRole="button"
                                    >
                                        <Text className="text-xs font-semibold text-gray-700">
                                            {t('friends.actions.reject')}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleAccept(req)}
                                        className="h-9 px-3 rounded-lg bg-primary items-center justify-center"
                                        accessibilityRole="button"
                                    >
                                        <Text className="text-xs font-semibold text-white">
                                            {t('friends.actions.accept')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {/* Friends list */}
                <View className="px-4 mb-4">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {t('friends.title')}
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('FindFriends')}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityRole="button"
                            testID="friends-find"
                        >
                            <Text className="text-xs font-semibold text-primary">
                                {t('friends.find.title')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {friendsQ.isLoading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : friends.length === 0 ? (
                        <EmptyState
                            iconName="people-outline"
                            title={t('friends.noFriends')}
                            message={t('friends.empty')}
                            actionTitle={t('friends.find.title')}
                            onAction={() => navigation.navigate('FindFriends')}
                        />
                    ) : (
                        <View className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
                            {friends.map((f, idx) => (
                                <TouchableOpacity
                                    key={f.id}
                                    onLongPress={() => setConfirmRemove(f)}
                                    delayLongPress={400}
                                    activeOpacity={0.7}
                                    className={`flex-row items-center px-3 py-3 ${
                                        idx < friends.length - 1 ? 'border-b border-slate-100' : ''
                                    }`}
                                >
                                    <MemberAvatar name={f.name} avatarUrl={f.avatarUrl} size="sm" />
                                    <View className="flex-1 ml-3">
                                        <Text className="text-sm font-medium text-gray-800">
                                            {f.name}
                                        </Text>
                                        {f.email ? (
                                            <Text className="text-xs text-gray-500" numberOfLines={1}>
                                                {f.email}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <AppIcon name="ellipsis-horizontal" size={18} color={colors.gray400} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <ConfirmDialog
                visible={confirmRemove !== null}
                title={t('friends.actions.remove')}
                message={t('friends.actions.removeConfirm')}
                confirmText={t('friends.actions.remove')}
                cancelText={t('common.cancel')}
                onConfirm={handleRemoveConfirmed}
                onCancel={() => setConfirmRemove(null)}
                destructive
            />
        </View>
    );
}
