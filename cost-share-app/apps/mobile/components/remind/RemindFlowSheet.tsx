/**
 * RemindFlowSheet — the entire "Remind to settle up" flow inside a SINGLE
 * bottom sheet (one React Native <Modal>). It walks through three steps —
 * ad gate → delivery options → compose — by swapping the sheet's content,
 * NOT by opening/closing separate modals.
 *
 * Why one modal: iOS can't present a view controller while another is
 * dismissing. Chaining three sibling <Modal>s (and the native rewarded-ad
 * VC) meant every handoff raced that constraint and could leave a stale,
 * invisible modal layer that swallows every touch — the settle-up screen
 * froze until it was unmounted (navigate back, re-enter). Here the modal is
 * presented once and dismissed once; the native ad simply presents on top of
 * the already-open sheet and dismisses back to it, so the race never exists.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CenterDialogShell } from '../CenterDialogShell';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { AdGateStep } from './AdGateStep';
import { resolveAutoTextInputStyle, useRtlLayout } from '../../hooks/useRtlLayout';

type Step = 'gate' | 'options' | 'compose';

interface RemindFlowSheetProps {
    visible: boolean;
    featureKey: string;
    defaultMessage: string;
    sending?: boolean;
    onSend: (mode: 'app' | 'share', message: string) => void;
    onClose: () => void;
}

export function RemindFlowSheet({
    visible,
    featureKey,
    defaultMessage,
    sending = false,
    onSend,
    onClose,
}: RemindFlowSheetProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [step, setStep] = useState<Step>('gate');
    const [composeMode, setComposeMode] = useState<'app' | 'share'>('app');
    const [message, setMessage] = useState(defaultMessage);
    // Bumped every time the sheet opens so the ad gate (and its useRewardedAd
    // hook) remounts with a fresh ad rather than reusing a consumed one.
    const [openSeq, setOpenSeq] = useState(0);
    const wasVisible = useRef(false);

    useEffect(() => {
        if (visible && !wasVisible.current) {
            // Opening: always restart at the gate with a fresh message + ad.
            setStep('gate');
            setMessage(defaultMessage);
            setOpenSeq(s => s + 1);
        }
        wasVisible.current = visible;
    }, [visible, defaultMessage]);

    // Gate + options share the flow title ("Send a Reminder"); only the compose
    // step swaps to its own label.
    const label =
        step === 'compose' ? t('remind.composeTitle') : t('remind.sheetTitle');

    const handleSend = () => {
        const trimmed = message.trim();
        if (!trimmed) return;
        onSend(composeMode, trimmed);
    };

    // Leading header action: only compose needs one — Back to the delivery
    // options. Gate and options have no header button; tapping outside the
    // dialog (the scrim) cancels the flow.
    const leftAction =
        step === 'compose'
            ? { label: t('common.back'), onPress: () => setStep('options') }
            : undefined;

    return (
        <CenterDialogShell
            visible={visible}
            label={label}
            onClose={onClose}
            leftLabel={leftAction?.label}
            onLeftPress={leftAction?.onPress}
            saveLabel={step === 'compose' ? t('remind.sendButton') : undefined}
            onSave={step === 'compose' ? handleSend : undefined}
            saveDisabled={step === 'compose' ? sending || !message.trim() : false}
        >
            {step === 'gate' && (
                <AdGateStep
                    key={openSeq}
                    active={visible}
                    featureKey={featureKey}
                    onCompleted={() => setStep('options')}
                />
            )}

            {step === 'options' && (
                <View className="px-4 pb-6 pt-2 gap-3">
                    <TouchableOpacity
                        onPress={() => {
                            setComposeMode('app');
                            setStep('compose');
                        }}
                        activeOpacity={0.8}
                        className="bg-primary rounded-2xl py-4 px-5 flex-row items-center justify-center gap-3"
                        testID="remind-via-app-button"
                    >
                        <AppIcon name="notifications-outline" size={20} color="#fff" />
                        <Text className="text-white font-semibold text-base text-center">
                            {t('remind.viaApp')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            setComposeMode('share');
                            setStep('compose');
                        }}
                        activeOpacity={0.7}
                        className="border border-gray-200 rounded-2xl py-4 px-5 flex-row items-center justify-center gap-3"
                        testID="remind-via-share-button"
                    >
                        <AppIcon name="share-outline" size={20} color="#6b7280" />
                        <Text className="text-gray-700 font-medium text-base text-center">
                            {t('remind.viaShare')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {step === 'compose' && (
                <View className="px-4 pb-6 pt-2">
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        numberOfLines={4}
                        style={[
                            resolveAutoTextInputStyle(isRtl),
                            {
                                borderWidth: 1,
                                borderColor: '#e5e7eb',
                                borderRadius: 12,
                                padding: 12,
                                fontSize: 15,
                                color: '#111827',
                                minHeight: 100,
                                textAlignVertical: 'top',
                            },
                        ]}
                        testID="remind-compose-input"
                    />
                </View>
            )}
        </CenterDialogShell>
    );
}

