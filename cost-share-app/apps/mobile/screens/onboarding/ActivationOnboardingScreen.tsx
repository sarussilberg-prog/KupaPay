/**
 * Guided activation: template + create group → first expense → invite (#392).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
    getActivationTemplate,
    type ActivationOnboardingStep,
    type ActivationTemplateId,
} from '@cost-share/shared';
import { platformAlert } from '../../lib/platformAlert';
import { showAppToast } from '../../lib/appToast';
import { useLoading } from '../../hooks/useLoading';
import { useAppStore } from '../../store';
import { createGroup } from '../../services/groups.service';
import { createExpense } from '../../services/expenses.service';
import { shareGroupInvite } from '../../services/invite.service';
import { markPostLoginOnboardingComplete } from '../../lib/onboardingStorage';
import { captureProductEvent, trackFirstExpenseAdded } from '../../lib/productAnalytics';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { CreateGroupFormShell } from '../../components/groups/CreateGroupFormShell';
import { CreateGroupFloatingButton } from '../../components/groups/CreateGroupFloatingButton';
import { Text } from '../../components/AppText';
import { AppIcon } from '../../components/AppIcon';
import { Input } from '../../components/Input';
import { ActivationStepIndicator } from '../../components/activation/ActivationStepIndicator';
import { ActivationTemplatePicker } from '../../components/activation/ActivationTemplatePicker';
import { colors } from '../../theme';
import { onboardingColors } from '../../theme/onboardingColors';
import { rtlTextClassName, useAppLanguage, useRtlLayout } from '../../hooks/useRtlLayout';
import { initialCreateGroupCurrency } from '../../lib/appDefaultCurrency';

type Props = {
    onDone: () => void;
    previewMode?: boolean;
};

function parseAmountInput(raw: string): number | null {
    const normalized = raw.replace(',', '.').trim();
    if (!normalized) return null;
    const n = Number.parseFloat(normalized);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
}

export function ActivationOnboardingScreen({ onDone, previewMode = false }: Props) {
    const { t } = useTranslation();
    const { bottom: safeBottom } = useSafeAreaInsets();
    const isRtl = useRtlLayout();
    const appLanguage = useAppLanguage();
    const currentUser = useAppStore((s) => s.currentUser);
    const { isLoading, startLoading, stopLoading } = useLoading();

    const [step, setStep] = useState<ActivationOnboardingStep>('create');
    const [templateId, setTemplateId] = useState<ActivationTemplateId>('trip');
    const template = useMemo(() => getActivationTemplate(templateId), [templateId]);

    const [name, setName] = useState('');
    const [nameError, setNameError] = useState('');
    const [groupId, setGroupId] = useState<string | null>(null);
    const [currency] = useState(() => initialCreateGroupCurrency(appLanguage, currentUser));

    const [expenseDescription, setExpenseDescription] = useState('');
    const [amountText, setAmountText] = useState('');
    const [amountError, setAmountError] = useState('');

    const applyTemplateDefaults = useCallback(
        (id: ActivationTemplateId) => {
            const def = getActivationTemplate(id);
            setTemplateId(id);
            setName(t(def.defaultNameKey));
            setExpenseDescription(t(def.defaultExpenseDescriptionKey));
            setAmountText(String(def.suggestedAmount));
            setNameError('');
            setAmountError('');
        },
        [t],
    );

    useEffect(() => {
        applyTemplateDefaults('trip');
        // Seed defaults once on mount only — re-running would reset the user's template pick.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finish = useCallback(async () => {
        if (!previewMode) {
            await markPostLoginOnboardingComplete();
        }
        onDone();
    }, [onDone, previewMode]);

    const confirmSkip = useCallback(
        (titleKey: string, messageKey: string, onConfirm: () => void) => {
            platformAlert(t(titleKey), t(messageKey), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('onboarding.activation.skipConfirm'),
                    style: 'destructive',
                    onPress: onConfirm,
                },
            ]);
        },
        [t],
    );

    const handleExit = useCallback(() => {
        if (previewMode) {
            onDone();
            return;
        }
        confirmSkip(
            'onboarding.create.skipTitle',
            'onboarding.create.skipMessage',
            () => void finish(),
        );
    }, [confirmSkip, finish, onDone, previewMode]);

    const handleCreateGroup = useCallback(async () => {
        if (!name.trim()) {
            setNameError(t('groups.nameRequired'));
            return;
        }
        setNameError('');
        startLoading();
        try {
            const group = await createGroup({
                name: name.trim(),
                groupType: template.groupType,
                defaultCurrency: currency,
                memberIds: [],
            });
            if (!group) {
                showAppToast({ type: 'error', titleKey: 'common.error' });
                return;
            }
            setGroupId(group.id);
            setStep('expense');
        } finally {
            stopLoading();
        }
    }, [currency, name, startLoading, stopLoading, t, template.groupType]);

    const handleAddExpense = useCallback(async () => {
        const amount = parseAmountInput(amountText);
        if (amount == null) {
            setAmountError(t('onboarding.activation.expense.amountRequired'));
            return;
        }
        if (!expenseDescription.trim()) {
            showAppToast({ type: 'error', titleKey: 'expenses.descriptionRequired' });
            return;
        }
        if (!groupId || !currentUser?.id) return;
        setAmountError('');
        startLoading();
        try {
            await createExpense({
                groupId,
                description: expenseDescription.trim(),
                amount,
                currency,
                category: template.expenseCategory,
                paidBy: currentUser.id,
                splits: [{ userId: currentUser.id }],
                splitMode: 'equal',
            });
            void invalidateBalanceCaches(groupId);
            void captureProductEvent('expense_added', {
                group_id: groupId,
                activation_flow: true,
            });
            void trackFirstExpenseAdded(groupId, { activation_template: templateId });
            setStep('invite');
        } catch {
            showAppToast({ type: 'error', titleKey: 'expenses.createError' });
        } finally {
            stopLoading();
        }
    }, [
        amountText,
        currency,
        currentUser?.id,
        expenseDescription,
        groupId,
        startLoading,
        stopLoading,
        t,
        template.expenseCategory,
        templateId,
    ]);

    const handleShareInvite = useCallback(async () => {
        if (!groupId) return;
        try {
            await shareGroupInvite(groupId);
        } catch {
            showAppToast({ type: 'error', titleKey: 'common.error' });
        }
    }, [groupId]);

    const headerTitle = t(
        step === 'create'
            ? 'onboarding.activation.header.create'
            : step === 'expense'
              ? 'onboarding.activation.header.expense'
              : 'onboarding.activation.header.invite',
    );

    const footer = (() => {
        if (step === 'create') {
            return (
                <CreateGroupFloatingButton
                    title={t('onboarding.activation.cta.createGroup')}
                    onPress={() => void handleCreateGroup()}
                    loading={isLoading}
                    disabled={isLoading || !name.trim()}
                    testID="activation-create-submit"
                />
            );
        }
        if (step === 'expense') {
            return (
                <View className="gap-2">
                    <CreateGroupFloatingButton
                        title={t('onboarding.activation.cta.addExpense')}
                        onPress={() => void handleAddExpense()}
                        loading={isLoading}
                        disabled={isLoading}
                        testID="activation-expense-submit"
                    />
                    <TouchableOpacity
                        onPress={() =>
                            confirmSkip(
                                'onboarding.activation.skipExpenseTitle',
                                'onboarding.activation.skipExpenseMessage',
                                () => setStep('invite'),
                            )
                        }
                        testID="activation-expense-skip"
                        className="py-2 items-center"
                    >
                        <Text className="text-sm font-semibold" style={{ color: colors.gray500 }}>
                            {t('onboarding.activation.cta.skipExpense')}
                        </Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View className="gap-2">
                <CreateGroupFloatingButton
                    title={
                        Platform.OS === 'web'
                            ? t('onboarding.activation.cta.shareInviteWeb')
                            : t('onboarding.activation.cta.shareInvite')
                    }
                    onPress={() => void handleShareInvite()}
                    loading={false}
                    disabled={!groupId}
                    testID="activation-invite-share"
                />
                <CreateGroupFloatingButton
                    title={t('onboarding.activation.cta.done')}
                    onPress={() => void finish()}
                    loading={false}
                    disabled={false}
                    testID="activation-invite-done"
                />
            </View>
        );
    })();

    return (
        <CreateGroupFormShell
            testID="activation-onboarding-screen"
            extraBottomInset={safeBottom}
            title={headerTitle}
            guidance={
                <View>
                    <ActivationStepIndicator current={step} />
                    <Text
                        className={rtlTextClassName(isRtl, 'text-sm')}
                        style={{ color: onboardingColors.muted, marginBottom: 8 }}
                    >
                        {t('onboarding.activation.subtitle')}
                    </Text>
                </View>
            }
            headerStart={
                <TouchableOpacity
                    onPress={handleExit}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    testID="activation-back"
                    accessibilityRole="button"
                >
                    <View className="w-9 h-9 rounded-full bg-white border border-slate-200 items-center justify-center">
                        <AppIcon
                            name={isRtl ? 'chevron-forward' : 'chevron-back'}
                            size={20}
                            color={colors.gray700}
                        />
                    </View>
                </TouchableOpacity>
            }
            headerEnd={
                <TouchableOpacity
                    onPress={handleExit}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="activation-skip"
                >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.gray500 }}>
                        {t(previewMode ? 'common.close' : 'onboarding.skip')}
                    </Text>
                </TouchableOpacity>
            }
            footer={footer}
        >
            {step === 'create' ? (
                <>
                    <ActivationTemplatePicker
                        selectedId={templateId}
                        onSelect={(id) => applyTemplateDefaults(id)}
                    />
                    <View className="mt-4">
                        <Input
                            label={t('onboarding.activation.fields.groupName')}
                            placeholder={t('groups.createForm.namePlaceholder')}
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                if (nameError) setNameError('');
                            }}
                            error={nameError}
                            testID="activation-group-name"
                        />
                    </View>
                </>
            ) : null}

            {step === 'expense' ? (
                <View className="gap-3">
                    <Text style={{ color: onboardingColors.muted, fontSize: 14 }}>
                        {t('onboarding.activation.expense.hint')}
                    </Text>
                    <Input
                        label={t('expenses.description')}
                        value={expenseDescription}
                        onChangeText={setExpenseDescription}
                        testID="activation-expense-description"
                    />
                    <Input
                        label={t('expenses.amount')}
                        value={amountText}
                        onChangeText={(text) => {
                            setAmountText(text);
                            if (amountError) setAmountError('');
                        }}
                        keyboardType="decimal-pad"
                        error={amountError}
                        testID="activation-expense-amount"
                    />
                </View>
            ) : null}

            {step === 'invite' ? (
                <View className="gap-3 items-center py-4">
                    <Text style={{ fontSize: 40 }}>🎉</Text>
                    <Text
                        className="text-center text-base font-semibold"
                        style={{ color: onboardingColors.ink }}
                    >
                        {t('onboarding.activation.invite.title')}
                    </Text>
                    <Text
                        className="text-center text-sm"
                        style={{ color: onboardingColors.muted, maxWidth: 320 }}
                    >
                        {t('onboarding.activation.invite.body')}
                    </Text>
                </View>
            ) : null}
        </CreateGroupFormShell>
    );
}
