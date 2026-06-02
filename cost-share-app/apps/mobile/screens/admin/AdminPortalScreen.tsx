import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { clearOnboardingFlags } from '../../lib/onboardingStorage';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsRow } from '../../components/settings/SettingsRow';

export function AdminPortalScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetting, setResetting] = useState(false);

    const onConfirmReset = useCallback(async () => {
        setResetting(true);
        try {
            await clearOnboardingFlags();
            setResetConfirmOpen(false);
            Toast.show({
                type: 'success',
                text1: t('admin.onboarding.resetSuccess'),
            });
            navigation.navigate('AdminOnboardingPreview');
        } finally {
            setResetting(false);
        }
    }, [navigation, t]);

    return (
        <>
            <ScrollView className="flex-1 bg-slate-50">
                <SettingsSection title={t('admin.portal.sectionLabel')}>
                    <SettingsRow
                        iconName="trash-outline"
                        label={t('admin.portal.deletedUsersRow')}
                        variant="chevron"
                        onPress={() => navigation.navigate('AdminDeletedUsers')}
                        testID="admin-portal-deleted-users"
                    />
                    <SettingsRow
                        iconName="refresh-outline"
                        label={t('admin.portal.resetOnboardingRow')}
                        variant="chevron"
                        onPress={() => setResetConfirmOpen(true)}
                        testID="admin-portal-reset-onboarding"
                    />
                    <SettingsRow
                        iconName="eye-outline"
                        label={t('admin.portal.previewCreateGroupRow')}
                        variant="chevron"
                        onPress={() => navigation.navigate('AdminOnboardingPreview')}
                        testID="admin-portal-preview-onboarding"
                    />
                </SettingsSection>
            </ScrollView>

            <ConfirmDialog
                visible={resetConfirmOpen}
                title={t('admin.onboarding.resetTitle')}
                message={t('admin.onboarding.resetMessage')}
                confirmText={t('admin.onboarding.resetConfirm')}
                cancelText={t('common.cancel')}
                destructive
                onConfirm={() => void onConfirmReset()}
                onCancel={() => {
                    if (!resetting) setResetConfirmOpen(false);
                }}
                confirmTestID="admin-onboarding-reset-confirm"
            />
        </>
    );
}
