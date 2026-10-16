/**
 * Branded settle-up / trip summary card captured as a share image (#399).
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppLogo } from '../AppLogo';
import { colors } from '../../theme';
import { useRtlLayout } from '../../hooks/useRtlLayout';

export type GroupSummaryShareLine = {
    id: string;
    label: string;
    value?: string;
};

type Props = {
    groupName: string;
    lines: GroupSummaryShareLine[];
    settled: boolean;
    hideAmounts: boolean;
};

export const GroupSummaryShareCard = React.forwardRef<View, Props>(function GroupSummaryShareCard(
    { groupName, lines, settled, hideAmounts },
    ref,
) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View
            ref={ref}
            collapsable={false}
            className="bg-white rounded-3xl p-6 border border-slate-200"
            style={{ width: 320, direction: isRtl ? 'rtl' : 'ltr' }}
            testID="group-summary-share-card"
        >
            <View className="flex-row items-center mb-4">
                <AppLogo size={36} />
                <Text className="text-lg font-bold text-gray-900 ms-3">KupaPay</Text>
            </View>
            <Text className="text-xl font-semibold text-gray-900 mb-1">{groupName}</Text>
            <Text className="text-sm text-gray-500 mb-4">
                {settled ? t('shareSummary.allSettled') : t('shareSummary.balancesSnapshot')}
            </Text>
            {lines.map(line => (
                <View key={line.id} className="flex-row justify-between py-2 border-b border-slate-100">
                    <Text className="text-sm text-gray-700 flex-1 pe-2">{line.label}</Text>
                    <Text className="text-sm font-semibold text-gray-900">
                        {hideAmounts ? t('shareSummary.hiddenAmount') : (line.value ?? '—')}
                    </Text>
                </View>
            ))}
            <Text className="text-xs text-gray-400 mt-4 text-center">
                {t('shareSummary.watermark', { url: APP_WEB_ORIGIN })}
            </Text>
        </View>
    );
});
