import React from 'react';
import { View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

export function SplitwiseImportPickPanel() {
    const { t } = useTranslation();
    return (
        <View className="items-center py-8 px-4 gap-4">
            <AppIcon name="document-text-outline" size={48} color={colors.primary} />
            <Text className="text-base text-gray-700 dark:text-gray-200 text-center">
                {t('splitwiseImport.pickPrompt')}
            </Text>
            {Platform.OS === 'web' ? (
                <Text className="text-xs text-gray-500 text-center">
                    {t('splitwiseImport.webNote')}
                </Text>
            ) : null}
        </View>
    );
}
