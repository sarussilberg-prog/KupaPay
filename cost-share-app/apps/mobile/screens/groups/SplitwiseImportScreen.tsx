/**
 * Import a Splitwise group CSV export into a new KupaPay group (#396).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
    defaultGuestDisplayNames,
    parseSplitwiseCsvExport,
    type SplitwiseParseSuccess,
    type SplitwiseSkipReason,
} from '@cost-share/shared';
import { CreateGroupFormShell } from '../../components/groups/CreateGroupFormShell';
import { Text } from '../../components/AppText';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AppIcon } from '../../components/AppIcon';
import { pickSplitwiseCsvFile } from '../../lib/pickSplitwiseCsv';
import { runSplitwiseImport } from '../../services/splitwise-import.service';
import { handleError } from '../../lib/handleError';
import { showSuccessMessage } from '../../lib/appToast';
import { captureProductEvent, trackFirstGroupCreated } from '../../lib/productAnalytics';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';

type Step = 'pick' | 'preview';

function groupNameFromFileName(fileName: string): string {
    return fileName.replace(/\.(csv|txt)$/i, '').trim() || 'Imported group';
}

export function SplitwiseImportScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const isRtl = useRtlLayout();

    const [step, setStep] = useState<Step>('pick');
    const [fileName, setFileName] = useState('');
    const [parseErrorKey, setParseErrorKey] = useState<string | null>(null);
    const [parsed, setParsed] = useState<SplitwiseParseSuccess | null>(null);
    const [groupName, setGroupName] = useState('');
    const [selfMemberName, setSelfMemberName] = useState('');
    const [guestNames, setGuestNames] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);

    const skipReasonLabel = useCallback(
        (reason: SplitwiseSkipReason) => t(`splitwiseImport.skipped.${reason}`),
        [t],
    );

    const handlePickFile = useCallback(async () => {
        setParseErrorKey(null);
        const picked = await pickSplitwiseCsvFile();
        if (!picked.ok) {
            if (picked.error !== 'cancelled') {
                setParseErrorKey(`splitwiseImport.errors.${picked.error}`);
            }
            return;
        }

        const result = parseSplitwiseCsvExport(picked.text);
        if (!result.ok) {
            setParseErrorKey(`splitwiseImport.errors.${result.error}`);
            return;
        }
        if (result.expenses.length === 0) {
            setParseErrorKey('splitwiseImport.errors.no_expenses');
            return;
        }

        setFileName(picked.fileName);
        setParsed(result);
        setGroupName(groupNameFromFileName(picked.fileName));
        setSelfMemberName(result.members[0] ?? '');
        setGuestNames(defaultGuestDisplayNames(result.members, result.members[0] ?? ''));
        setStep('preview');
    }, []);

    const previewSummary = useMemo(() => {
        if (!parsed) return null;
        return t('splitwiseImport.preview.summary', {
            expenseCount: parsed.expenses.length,
            memberCount: parsed.members.length,
            skippedCount: parsed.skipped.length,
        });
    }, [parsed, t]);

    const handleImport = useCallback(async () => {
        if (!parsed || !selfMemberName) return;
        setImporting(true);
        try {
            const mapping = {
                selfMemberName,
                guestDisplayNames: Object.fromEntries(
                    parsed.members
                        .filter((m) => m !== selfMemberName)
                        .map((m) => [m, guestNames[m]?.trim() || m]),
                ),
            };

            const outcome = await runSplitwiseImport({
                groupName,
                defaultCurrency: parsed.defaultCurrency,
                expenses: parsed.expenses,
                mapping,
                skippedCount: parsed.skipped.length,
            });

            if (!outcome.ok) {
                setParseErrorKey(`splitwiseImport.errors.${outcome.error}`);
                return;
            }

            void trackFirstGroupCreated(outcome.groupId);
            void captureProductEvent('group_created', { source: 'splitwise_import' });
            void queryClient.invalidateQueries({ queryKey: queryKeys.groups });
            invalidateBalanceCaches();
            showSuccessMessage(t('splitwiseImport.success', { count: outcome.importedCount }));
            navigation.navigate('Groups', {
                screen: 'GroupDetail',
                params: { groupId: outcome.groupId },
            });
            navigation.goBack();
        } catch (error) {
            handleError(error, {
                toast: { titleKey: 'splitwiseImport.title', messageKey: 'splitwiseImport.errors.import_failed' },
            });
        } finally {
            setImporting(false);
        }
    }, [parsed, selfMemberName, guestNames, groupName, navigation, t]);

    const footer =
        step === 'pick' ? (
            <Button title={t('splitwiseImport.pickFile')} onPress={() => void handlePickFile()} />
        ) : (
            <Button
                title={t('splitwiseImport.importCta')}
                onPress={() => void handleImport()}
                disabled={importing || !groupName.trim() || !selfMemberName}
                loading={importing}
            />
        );

    return (
        <CreateGroupFormShell
            testID="splitwise-import-screen"
            title={t('splitwiseImport.title')}
            extraBottomInset={insets.bottom}
            headerStart={
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    testID="splitwise-import-cancel"
                >
                    <Text style={{ fontSize: 15, fontWeight: '500', color: colors.gray600 }}>
                        {t('common.cancel')}
                    </Text>
                </TouchableOpacity>
            }
            guidance={
                parseErrorKey ? (
                    <Text className="text-sm text-red-600 mb-2">{t(parseErrorKey)}</Text>
                ) : (
                    <Text className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {t('splitwiseImport.hint')}
                    </Text>
                )
            }
            footer={footer}
        >
            {step === 'pick' ? (
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
            ) : parsed ? (
                <View className="gap-4 px-1">
                    <Text className="text-sm text-gray-600 dark:text-gray-300">{fileName}</Text>
                    {previewSummary ? (
                        <Text className="text-base font-medium text-gray-900 dark:text-gray-50">
                            {previewSummary}
                        </Text>
                    ) : null}

                    <Input
                        label={t('splitwiseImport.groupNameLabel')}
                        value={groupName}
                        onChangeText={setGroupName}
                        testID="splitwise-import-group-name"
                    />

                    <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {t('splitwiseImport.selfMemberLabel')}
                    </Text>
                    {parsed.members.map((member) => {
                        const selected = member === selfMemberName;
                        return (
                            <TouchableOpacity
                                key={member}
                                onPress={() => {
                                    setSelfMemberName(member);
                                    setGuestNames(defaultGuestDisplayNames(parsed.members, member));
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                style={rtlRowStyle(isRtl)}
                                className="items-center gap-3 py-2"
                                testID={`splitwise-member-${member}`}
                            >
                                <AppIcon
                                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={22}
                                    color={selected ? colors.primary : colors.gray400}
                                />
                                <Text className="flex-1 text-base text-gray-900 dark:text-gray-50">
                                    {member}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}

                    {parsed.members.filter((m) => m !== selfMemberName).length > 0 ? (
                        <>
                            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-2">
                                {t('splitwiseImport.guestNamesLabel')}
                            </Text>
                            {parsed.members
                                .filter((m) => m !== selfMemberName)
                                .map((member) => (
                                    <Input
                                        key={member}
                                        label={member}
                                        value={guestNames[member] ?? member}
                                        onChangeText={(text) =>
                                            setGuestNames((prev) => ({ ...prev, [member]: text }))
                                        }
                                    />
                                ))}
                        </>
                    ) : null}

                    {parsed.skipped.length > 0 ? (
                        <View className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 gap-1">
                            <Text className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                {t('splitwiseImport.skippedTitle', { count: parsed.skipped.length })}
                            </Text>
                            {parsed.skipped.slice(0, 5).map((row) => (
                                <Text
                                    key={`${row.lineNumber}-${row.reason}`}
                                    className="text-xs text-amber-800 dark:text-amber-200"
                                >
                                    {t('splitwiseImport.skipped.line', {
                                        line: row.lineNumber,
                                        reason: skipReasonLabel(row.reason),
                                    })}
                                </Text>
                            ))}
                            {parsed.skipped.length > 5 ? (
                                <Text className="text-xs text-amber-700 dark:text-amber-300">
                                    {t('splitwiseImport.skipped.more', {
                                        count: parsed.skipped.length - 5,
                                    })}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}

                    <View className="mt-2 gap-2">
                        <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('splitwiseImport.previewExpensesTitle')}
                        </Text>
                        {parsed.expenses.slice(0, 8).map((exp) => (
                            <View
                                key={exp.lineNumber}
                                style={rtlRowStyle(isRtl)}
                                className="justify-between gap-2 py-1 border-b border-gray-100 dark:border-gray-800"
                            >
                                <Text
                                    className="flex-1 text-sm text-gray-900 dark:text-gray-50"
                                    numberOfLines={1}
                                >
                                    {exp.description}
                                </Text>
                                <Text className="text-sm text-gray-600 dark:text-gray-300 shrink-0">
                                    {exp.currency} {exp.amount.toFixed(2)}
                                </Text>
                            </View>
                        ))}
                        {parsed.expenses.length > 8 ? (
                            <Text className="text-xs text-gray-500">
                                {t('splitwiseImport.preview.more', {
                                    count: parsed.expenses.length - 8,
                                })}
                            </Text>
                        ) : null}
                    </View>

                    <Button
                        title={t('splitwiseImport.changeFile')}
                        variant="outline"
                        onPress={() => {
                            setStep('pick');
                            setParsed(null);
                        }}
                    />
                </View>
            ) : null}
        </CreateGroupFormShell>
    );
}
