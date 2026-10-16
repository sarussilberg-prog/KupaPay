import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RecurringFrequency } from '@cost-share/shared';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
const FREQUENCIES: RecurringFrequency[] = ['weekly', 'monthly', 'yearly'];

interface RecurringFrequencySheetProps {
    visible: boolean;
    value: RecurringFrequency;
    onSelect: (frequency: RecurringFrequency) => void;
    onClose: () => void;
}

export function RecurringFrequencySheet({
    visible,
    value,
    onSelect,
    onClose,
}: RecurringFrequencySheetProps) {
    const { t } = useTranslation();

    return (
        <BottomSheetShell
            visible={visible}
            onClose={onClose}
            label={t('expenses.v2.recurring.sheetTitle')}
        >
            <View className="gap-2 px-4 pb-6">
                {FREQUENCIES.map(freq => {
                    const selected = freq === value;
                    return (
                        <TouchableOpacity
                            key={freq}
                            onPress={() => {
                                onSelect(freq);
                                onClose();
                            }}
                            className={`rounded-xl py-4 px-4 border ${
                                selected ? 'border-primary bg-primary-extra-light' : 'border-gray-200 bg-white'
                            }`}
                            testID={`recurring-frequency-${freq}`}
                        >
                            <Text
                                className={`text-center font-semibold ${
                                    selected ? 'text-primary-dark' : 'text-gray-800'
                                }`}
                            >
                                {t(`expenses.v2.recurring.frequency.${freq}`)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </BottomSheetShell>
    );
}
