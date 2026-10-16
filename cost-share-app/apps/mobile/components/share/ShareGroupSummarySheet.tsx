import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View, TouchableOpacity, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PairwiseDebt } from '@cost-share/shared';
import { formatMoney } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { Button } from '../Button';
import { colors } from '../../theme';
import { GroupSummaryShareCard } from './GroupSummaryShareCard';
import { shareGroupSummaryFromRef } from '../../lib/shareGroupSummaryImage';
import { getGroupInviteSharePayload } from '../../services/invite.service';

type Props = {
    visible: boolean;
    onClose: () => void;
    groupName: string;
    groupId: string;
    inviteToken?: string;
    debts: PairwiseDebt[];
    nameById: Record<string, string>;
    settled: boolean;
};

export function ShareGroupSummarySheet({
    visible,
    onClose,
    groupId,
    groupName,
    inviteToken,
    debts,
    nameById,
    settled,
}: Props) {
    const { t, i18n } = useTranslation();
    const cardRef = useRef<View>(null);
    const [hideAmounts, setHideAmounts] = useState(false);
    const [sharing, setSharing] = useState(false);
    const lines = useMemo(
        () =>
            debts.slice(0, 8).map(d => ({
                id: `${d.fromUserId}-${d.toUserId}-${d.currency}`,
                label: t('shareSummary.debtLine', {
                    from: nameById[d.fromUserId] ?? t('common.groupMember'),
                    to: nameById[d.toUserId] ?? t('common.groupMember'),
                }),
                value: formatMoney(d.amount, d.currency, { language: i18n.language }),
            })),
        [debts, nameById, t, i18n.language],
    );

    const fallbackMessage = useMemo(() => {
        try {
            return getGroupInviteSharePayload(groupId).message;
        } catch {
            return t('shareSummary.fallback', { groupName });
        }
    }, [groupId, groupName, t]);

    const handleShare = async () => {
        setSharing(true);
        try {
            await shareGroupSummaryFromRef(cardRef, fallbackMessage);
        } finally {
            setSharing(false);
            onClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-center px-4">
                <Pressable onPress={() => {}} className="bg-white rounded-2xl p-4 max-h-[90%]">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-base font-semibold text-gray-900">
                            {t('shareSummary.title')}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <AppIcon name="close" size={22} color={colors.gray500} />
                        </TouchableOpacity>
                    </View>
                    <View className="items-center mb-4">
                        <GroupSummaryShareCard
                            ref={cardRef}
                            groupName={groupName}
                            lines={lines}
                            settled={settled}
                            hideAmounts={hideAmounts}
                        />
                    </View>
                    <View className="flex-row items-center justify-between mb-4 px-1">
                        <Text className="text-sm text-gray-700">{t('shareSummary.hideAmounts')}</Text>
                        <Switch
                            value={hideAmounts}
                            onValueChange={setHideAmounts}
                            testID="share-summary-hide-amounts"
                        />
                    </View>
                    <Button
                        title={t('shareSummary.share')}
                        onPress={() => void handleShare()}
                        loading={sharing}
                        testID="share-summary-confirm"
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
}
