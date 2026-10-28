import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';

type Props = Readonly<{
    testID?: string;
    compact?: boolean;
}>;

/** Subtle Pro label for profile / settings headers. */
export function ProBadge({ testID = 'pro-badge', compact = false }: Props) {
    const { t } = useTranslation();
    return (
        <View
            testID={testID}
            className={`rounded-full bg-amber-50 border border-amber-200/80 ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
        >
            <Text className={`font-semibold text-amber-900 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {t('pro.badge')}
            </Text>
        </View>
    );
}
