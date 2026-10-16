/**
 * Lets a new member claim a placeholder guest row after joining via invite (#395).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import {
    claimGuestGroupMember,
    listClaimableGuestMembers,
    type ClaimableGuest,
} from '../../services/groups.service';

type Props = {
    visible: boolean;
    groupId: string;
    onClose: () => void;
    onClaimed?: () => void;
};

export function ClaimGuestMembersSheet({ visible, groupId, onClose, onClaimed }: Props) {
    const { t } = useTranslation();
    const [guests, setGuests] = useState<ClaimableGuest[]>([]);
    const [loading, setLoading] = useState(false);
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        void listClaimableGuestMembers(groupId)
            .then(setGuests)
            .finally(() => setLoading(false));
    }, [visible, groupId]);

    const handleClaim = useCallback(
        async (guestUserId: string) => {
            if (submittingId) return;
            setSubmittingId(guestUserId);
            try {
                const ok = await claimGuestGroupMember(groupId, guestUserId);
                if (ok) {
                    onClaimed?.();
                    onClose();
                }
            } finally {
                setSubmittingId(null);
            }
        },
        [groupId, onClaimed, onClose, submittingId],
    );

    if (!visible) return null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-center px-4">
                <Pressable onPress={() => {}} className="bg-white rounded-2xl max-h-[70%]">
                    <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
                        <Text className="text-base font-semibold text-gray-900 flex-1 pe-2">
                            {t('invite.guestClaim.title')}
                        </Text>
                        <TouchableOpacity onPress={onClose} accessibilityLabel={t('invite.guestClaim.skip')}>
                            <AppIcon name="close" size={22} color={colors.gray500} />
                        </TouchableOpacity>
                    </View>
                    <Text className="px-4 pb-3 text-sm text-gray-500">{t('invite.guestClaim.subtitle')}</Text>
                    {loading ? (
                        <View className="py-8 items-center">
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : (
                        <View className="px-4 pb-4 gap-2">
                            {guests.map(g => (
                                <TouchableOpacity
                                    key={g.userId}
                                    onPress={() => void handleClaim(g.userId)}
                                    disabled={Boolean(submittingId)}
                                    className="h-12 rounded-xl border border-slate-200 flex-row items-center px-4"
                                    testID={`claim-guest-${g.userId}`}
                                >
                                    <Text className="text-base text-gray-900 flex-1">{g.displayName}</Text>
                                    {submittingId === g.userId ? (
                                        <ActivityIndicator color={colors.primary} />
                                    ) : (
                                        <Text className="text-sm font-semibold text-primary">
                                            {t('invite.guestClaim.confirm')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
