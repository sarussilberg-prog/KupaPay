import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { IconLabel } from '../ui/IconLabel';
import { ListRow } from '../ui/ListRow';

export function ContactSupportRow() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const navigation = useNavigation<any>();

    const handlePress = useCallback(() => {
        navigation.navigate('ContactUs');
    }, [navigation]);

    return (
        <ListRow onPress={handlePress} testID="settings-contact-row">
            <IconLabel iconName="mail-outline" iconColor={colors.gray500} label={t('settings.contactUs')} />
            <AppIcon name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.gray400} />
        </ListRow>
    );
}
