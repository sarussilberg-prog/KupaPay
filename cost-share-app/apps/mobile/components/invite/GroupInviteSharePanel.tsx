/**
 * Shared post-create (and onboarding) group invite UI — share sheet, WhatsApp, copy, QR.
 * Works on iOS, Android, and Expo web with platform-native affordances.
 */

import React, { useCallback } from 'react';
import { Platform, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { IconLabel } from '../ui/IconLabel';
import { colors } from '../../theme';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useEnsureGroupInviteToken } from '../../hooks/useEnsureGroupInviteToken';
import { useInviteLink } from '../../hooks/useInviteLink';
import { handleError } from '../../lib/handleError';
import {
    copyGroupInviteLink,
    shareGroupInviteViaWhatsApp,
} from '../../services/invite.service';

export type GroupInviteSharePanelProps = {
    groupId: string;
    groupName: string;
    /** Primary dismiss — user finished inviting or wants to continue. */
    onContinue: () => void;
    /** Skippable path (same destination as continue by default). */
    onSkip: () => void;
    continueLabelKey?: string;
    skipLabelKey?: string;
    testID?: string;
};

const IS_WEB = Platform.OS === 'web';

function inviteActionError(err: unknown, op: string, groupId: string) {
    handleError(err, {
        toast: { titleKey: 'common.error' },
        tags: { service: 'invite', op, kind: 'group' },
        extra: { groupId },
    });
}

export function GroupInviteSharePanel({
    groupId,
    groupName,
    onContinue,
    onSkip,
    continueLabelKey = 'invite.postCreate.continue',
    skipLabelKey = 'invite.postCreate.skip',
    testID = 'group-invite-share-panel',
}: GroupInviteSharePanelProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const tokenReady = useEnsureGroupInviteToken(groupId);
    const { url, isReady, share } = useInviteLink(groupId);
    const showContent = tokenReady && isReady && Boolean(url);

    const runShare = useCallback(async () => {
        try {
            await share();
        } catch (err) {
            inviteActionError(err, 'share', groupId);
        }
    }, [groupId, share]);

    const runWhatsApp = useCallback(async () => {
        try {
            await shareGroupInviteViaWhatsApp(groupId);
        } catch (err) {
            inviteActionError(err, 'whatsapp', groupId);
        }
    }, [groupId]);

    const runCopy = useCallback(async () => {
        try {
            await copyGroupInviteLink(groupId);
        } catch (err) {
            inviteActionError(err, 'copy', groupId);
        }
    }, [groupId]);

    const shareLabel = IS_WEB
        ? t('invite.postCreate.shareSheetWeb')
        : t('invite.postCreate.shareSheet');

    const actionButtonClass = Platform.select({
        ios: 'rounded-2xl py-3.5 px-4',
        android: 'rounded-xl py-3.5 px-4',
        default: 'rounded-xl py-3 px-4 border border-slate-200',
    });

    return (
        <View className="flex-1 px-5 pt-2 pb-4" testID={testID}>
            <Text
                className="text-2xl font-bold text-gray-900 mb-2"
                style={{ textAlign: isRtl ? 'right' : 'left' }}
            >
                {t('invite.postCreate.title')}
            </Text>
            <Text
                className="text-base text-gray-600 mb-6 leading-6"
                style={{ textAlign: isRtl ? 'right' : 'left' }}
            >
                {t('invite.postCreate.subtitle', { groupName })}
            </Text>

            {!showContent ? (
                <View className="items-center py-12">
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : (
                <>
                    <View className="items-center mb-6 bg-white rounded-2xl border border-slate-200/80 py-6 px-4">
                        <QRCode value={url} size={IS_WEB ? 200 : 168} />
                        <Text className="text-sm text-gray-500 mt-4 text-center">
                            {t('invite.postCreate.qrHint')}
                        </Text>
                    </View>

                    <View className="gap-3 mb-6">
                        <TouchableOpacity
                            onPress={() => void runShare()}
                            className={`bg-primary ${actionButtonClass} flex-row items-center justify-center`}
                            testID="group-invite-share-sheet"
                            accessibilityRole="button"
                        >
                            <IconLabel
                                iconName="share-outline"
                                iconSize={22}
                                iconColor="#fff"
                                label={shareLabel}
                                labelClassName="text-base font-semibold text-white"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => void runWhatsApp()}
                            className={`bg-[#25D366] ${actionButtonClass} flex-row items-center justify-center`}
                            testID="group-invite-whatsapp"
                            accessibilityRole="button"
                        >
                            <IconLabel
                                iconName="logo-whatsapp"
                                iconSize={22}
                                iconColor="#fff"
                                label={t('invite.postCreate.whatsapp')}
                                labelClassName="text-base font-semibold text-white"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => void runCopy()}
                            className={`bg-white border border-slate-200 ${actionButtonClass} flex-row items-center justify-center`}
                            testID="group-invite-copy-link"
                            accessibilityRole="button"
                        >
                            <IconLabel
                                iconName="link-outline"
                                iconSize={22}
                                iconColor={colors.primary}
                                label={t('invite.postCreate.copyLink')}
                                labelClassName="text-base font-semibold text-gray-800"
                            />
                        </TouchableOpacity>
                    </View>
                </>
            )}

            <View className="mt-auto gap-3">
                <TouchableOpacity
                    onPress={onContinue}
                    className="rounded-2xl py-3.5 items-center bg-slate-900"
                    testID="group-invite-continue"
                    accessibilityRole="button"
                >
                    <Text className="text-base font-semibold text-white">
                        {t(continueLabelKey)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onSkip}
                    className="py-2 items-center"
                    testID="group-invite-skip"
                    accessibilityRole="button"
                >
                    <Text className="text-base font-medium text-gray-500">
                        {t(skipLabelKey)}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
