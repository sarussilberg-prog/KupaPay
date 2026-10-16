import React, { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import {
    fetchGroupSmartReminderSettings,
    setGroupSmartReminder,
} from '../../services/smartReminders.service';
import { captureProductEvent } from '../../lib/productAnalytics';

interface SmartReminderSheetProps {
    visible: boolean;
    groupId: string;
    unlocked: boolean;
    onClose: () => void;
    onUpgrade: () => void;
}

const INTERVALS = [3, 7, 14];

export function SmartReminderSheet({
    visible,
    groupId,
    unlocked,
    onClose,
    onUpgrade,
}: SmartReminderSheetProps) {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(false);
    const [intervalDays, setIntervalDays] = useState(7);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;
        void fetchGroupSmartReminderSettings(groupId).then(row => {
            if (!row) return;
            setEnabled(row.enabled);
            setIntervalDays(row.intervalDays ?? 7);
        });
    }, [visible, groupId]);

    const handleSave = async () => {
        if (!unlocked) {
            onUpgrade();
            return;
        }
        setLoading(true);
        const ok = await setGroupSmartReminder(groupId, enabled, intervalDays);
        setLoading(false);
        if (ok) {
            void captureProductEvent('smart_reminder_configured', {
                group_id: groupId,
                enabled,
                interval_days: intervalDays,
            });
            onClose();
        }
    };

    return (
        <BottomSheetShell
            visible={visible}
            label={t('pro.smartReminder.sheetTitle')}
            onClose={onClose}
            onSave={handleSave}
            saveDisabled={loading}
        >
            <View className="px-4 pb-6 gap-4">
                {!unlocked ? (
                    <Text className="text-gray-600 text-sm">{t('pro.smartReminder.lockedBody')}</Text>
                ) : null}
                <View className="flex-row items-center justify-between">
                    <Text className="text-base font-medium text-gray-900">
                        {t('pro.smartReminder.enable')}
                    </Text>
                    <Switch value={enabled} onValueChange={setEnabled} disabled={!unlocked} />
                </View>
                {INTERVALS.map(days => (
                    <Pressable
                        key={days}
                        disabled={!unlocked}
                        onPress={() => setIntervalDays(days)}
                        className={`rounded-xl border px-4 py-3 ${
                            intervalDays === days ? 'border-primary bg-primary-extra-light' : 'border-gray-200'
                        }`}
                    >
                        <Text className="text-center font-medium text-gray-800">
                            {t('pro.smartReminder.intervalDays', { count: days })}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </BottomSheetShell>
    );
}
