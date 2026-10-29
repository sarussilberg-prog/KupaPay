import React, { useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SplitwiseParseSuccess, SplitwiseSkipReason } from '@cost-share/shared';
import { Text } from '../AppText';
import { Input } from '../Input';
import { Button } from '../Button';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

type Props = {
    fileName: string;
    parsed: SplitwiseParseSuccess;
    previewSummary: string | null;
    groupName: string;
    onGroupNameChange: (value: string) => void;
    selfMemberName: string;
    onSelectSelfMember: (member: string) => void;
    guestNames: Record<string, string>;
    onGuestNameChange: (member: string, value: string) => void;
    onChangeFile: () => void;
};

export function SplitwiseImportPreviewPanel({
    fileName,
    parsed,
    previewSummary,
    groupName,
    onGroupNameChange,
    selfMemberName,
    onSelectSelfMember,
    guestNames,
    onGuestNameChange,
    onChangeFile,
}: Props) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    const skipReasonLabel = useCallback(
        (reason: SplitwiseSkipReason) => t(`splitwiseImport.skipped.${reason}`),
        [t],
    );

    const otherMembers = parsed.members.filter((m) => m !== selfMemberName);
    const hasOtherMembers = parsed.members.some((m) => m !== selfMemberName);

    return (
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
                onChangeText={onGroupNameChange}
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
                        onPress={() => onSelectSelfMember(member)}
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

            {hasOtherMembers ? (
                <>
                    <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-2">
                        {t('splitwiseImport.guestNamesLabel')}
                    </Text>
                    {otherMembers.map((member) => (
                        <Input
                            key={member}
                            label={member}
                            value={guestNames[member] ?? member}
                            onChangeText={(text) => onGuestNameChange(member, text)}
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

            <Button title={t('splitwiseImport.changeFile')} variant="outline" onPress={onChangeFile} />
        </View>
    );
}
