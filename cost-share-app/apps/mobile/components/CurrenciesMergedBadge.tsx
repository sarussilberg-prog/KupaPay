import React from 'react';
import { View } from 'react-native';
import { Text } from './AppText';
import { useTranslation } from 'react-i18next';

interface CurrenciesMergedBadgeProps {
    count: number;
    /** Use when the badge sits on a gray (not white) background */
    darker?: boolean;
}

export function CurrenciesMergedBadge({ count, darker = false }: CurrenciesMergedBadgeProps) {
    const { t } = useTranslation();
    if (count <= 0) return null;
    return (
        <View style={{
            backgroundColor: darker ? '#cbd5e1' : '#f1f5f9',
            borderRadius: 4,
            paddingHorizontal: 5,
            paddingVertical: 2,
            alignSelf: 'flex-start',
            marginTop: 2,
        }}>
            <Text style={{ fontSize: 10, color: darker ? '#475569' : '#6b7280', fontWeight: '500', writingDirection: 'ltr' }}>
                {t('consolidation.batchRowMeta', { count })}
            </Text>
        </View>
    );
}
