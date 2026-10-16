import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';
import { settingsRowContainerStyle } from './settingsRowLayout';

export function ContactSupportRow() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const navigation = useNavigation<any>();

    const handlePress = useCallback(() => {
        navigation.navigate('ContactUs');
    }, [navigation]);

    return (
        <TouchableOpacity onPress={handlePress} testID="settings-contact-row">
            <View className="bg-white px-4 py-3.5 min-h-[52px]" style={settingsRowContainerStyle(isRtl)}>
                <AppIcon name="mail-outline" size={22} color={colors.gray500} />
                <Text
                    className={`flex-1 min-w-0 text-base text-gray-900 ${rtlTextClassName(isRtl, 'text-base text-gray-900')}`}
                >
                    {t('settings.contactUs')}
                </Text>
                <AppIcon name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.gray400} />
            </View>
        </TouchableOpacity>
    );
}
