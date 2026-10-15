/**
 * Pro: scheduled payment reminder digest settings + WhatsApp share template.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { PairwiseDebt } from '@cost-share/shared';
import { Text } from '../AppText';
import { KUPAPAY_PRO_ENABLED } from '../../lib/featureFlags';
import {
    buildSmartReminderWhatsAppBody,
    type SmartReminderIntervalDays,
} from '../../lib/smartPaymentReminder';
import {
    fetchGroupSmartReminderInterval,
    setGroupSmartReminderInterval,
} from '../../services/smartPaymentReminder.service';
import { getSettleReminderShareUrl } from '../../services/remind.service';
import { shareTextMessage } from '../../lib/platformShare';
import { joinAmounts } from '../../lib/reminderMessage';
import { useRtlLayout } from '../../hooks/useRtlLayout';

const INTERVAL_OPTIONS: Array<{ days: SmartReminderIntervalDays; labelKey: string }> = [
    { days: null, labelKey: 'pro.smartReminder.off' },
    { days: 3, labelKey: 'pro.smartReminder.every3Days' },
    { days: 7, labelKey: 'pro.smartReminder.every7Days' },
    { days: 14, labelKey: 'pro.smartReminder.every14Days' },
];

interface SmartPaymentReminderSectionProps {
    groupId: string;
    groupName: string;
    unlocked: boolean;
    currentUserId: string;
    debts: PairwiseDebt[];
    nameById: Record<string, string>;
}

export function SmartPaymentReminderSection({
    groupId,
    groupName,
    unlocked,
    currentUserId,
    debts,
    nameById,
}: SmartPaymentReminderSectionProps) {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const isRtl = useRtlLayout();
    const [reminderInterval, setReminderInterval] = useState<SmartReminderIntervalDays>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void fetchGroupSmartReminderInterval(groupId).then(value => {
            if (!cancelled) {
                setReminderInterval(value);
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [groupId]);

    const openPaywall = useCallback(() => {
        navigation.navigate('Paywall', {
            featureKey: 'smart_payment_reminder',
            groupId,
            showTripPass: true,
        });
    }, [navigation, groupId]);

    const pickInterval = useCallback(
        async (days: SmartReminderIntervalDays) => {
            if (!unlocked) {
                openPaywall();
                return;
            }
            setSaving(true);
            const ok = await setGroupSmartReminderInterval(groupId, days);
            setSaving(false);
            if (ok) setReminderInterval(days);
        },
        [groupId, openPaywall, unlocked],
    );

    const shareWhatsApp = useCallback(async () => {
        if (!unlocked) {
            openPaywall();
            return;
        }
        const debtors = [...new Set(debts.map(d => d.fromUserId))];
        const firstDebtor = debtors.find(id => id !== currentUserId) ?? debtors[0];
        if (!firstDebtor) return;
        const owedToMe = debts.filter(d => d.toUserId === currentUserId && d.fromUserId === firstDebtor);
        const lines =
            owedToMe.length > 0
                ? owedToMe.map(d => `${d.currency} ${d.amount.toFixed(2)}`)
                : debts
                      .filter(d => d.fromUserId === firstDebtor)
                      .map(d => `${d.currency} ${d.amount.toFixed(2)}`);
        const url = await getSettleReminderShareUrl(groupId);
        const body = buildSmartReminderWhatsAppBody({
            groupName,
            debtorName: nameById[firstDebtor] ?? '—',
            amountLines: lines.length > 0 ? lines : [joinAmounts(debts.filter(d => d.fromUserId === firstDebtor), t('remind.amountAnd'))],
            settleUrl: url,
            introLine: t('pro.smartReminder.whatsAppIntro'),
            andWord: t('remind.amountAnd'),
        });
        await shareTextMessage(body);
    }, [currentUserId, debts, groupId, groupName, nameById, openPaywall, t, unlocked]);

    if (!KUPAPAY_PRO_ENABLED) return null;

    if (!unlocked) {
        return (
            <View className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <Text className="text-gray-800 font-semibold mb-1">{t('pro.smartReminder.title')}</Text>
                <Text className="text-gray-600 text-sm mb-3">{t('pro.smartReminder.lockedBody')}</Text>
                <TouchableOpacity onPress={openPaywall} className="bg-primary rounded-xl py-3 items-center">
                    <Text className="text-white font-semibold">{t('pro.tripCurrency.upgrade')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="mb-4 p-4 rounded-2xl bg-white border border-gray-100">
            <Text className="text-gray-900 font-semibold mb-1">{t('pro.smartReminder.title')}</Text>
            <Text className="text-gray-600 text-sm mb-3">{t('pro.smartReminder.body')}</Text>
            <View className={`flex-row flex-wrap gap-2 mb-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                {INTERVAL_OPTIONS.map(opt => {
                    const active = reminderInterval === opt.days;
                    return (
                        <TouchableOpacity
                            key={opt.labelKey}
                            disabled={loading || saving}
                            onPress={() => void pickInterval(opt.days)}
                            className={`px-3 py-2 rounded-full border ${
                                active ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-700'}`}>
                                {t(opt.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <Text className="text-xs text-gray-500 mb-3">{t('pro.smartReminder.spamNote')}</Text>
            <TouchableOpacity
                onPress={() => void shareWhatsApp()}
                className="border border-primary rounded-xl py-3 items-center"
            >
                <Text className="text-primary font-semibold">{t('pro.smartReminder.whatsAppCta')}</Text>
            </TouchableOpacity>
        </View>
    );
}
