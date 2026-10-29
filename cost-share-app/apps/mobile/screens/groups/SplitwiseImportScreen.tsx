/**
 * Import a Splitwise group CSV export into a new KupaPay group (#396).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
    defaultGuestDisplayNames,
    parseSplitwiseCsvExport,
    type SplitwiseParseSuccess,
} from '@cost-share/shared';
import { CreateGroupFormShell } from '../../components/groups/CreateGroupFormShell';
import { SplitwiseImportPickPanel } from '../../components/splitwiseImport/SplitwiseImportPickPanel';
import { SplitwiseImportPreviewPanel } from '../../components/splitwiseImport/SplitwiseImportPreviewPanel';
import { Text } from '../../components/AppText';
import { Button } from '../../components/Button';
import { pickSplitwiseCsvFile } from '../../lib/pickSplitwiseCsv';
import { runSplitwiseImport } from '../../services/splitwise-import.service';
import { handleError } from '../../lib/handleError';
import { showSuccessMessage } from '../../lib/appToast';
import { captureProductEvent, trackFirstGroupCreated } from '../../lib/productAnalytics';
import { invalidateBalanceCaches } from '../../lib/invalidateBalanceCaches';
import { queryClient } from '../../lib/queryClient';
import { queryKeys } from '../../hooks/queries/keys';
import { colors } from '../../theme';

type Step = 'pick' | 'preview';

function groupNameFromFileName(fileName: string): string {
    return fileName.replace(/\.(csv|txt)$/i, '').trim() || 'Imported group';
}

export function SplitwiseImportScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();

    const [step, setStep] = useState<Step>('pick');
    const [fileName, setFileName] = useState('');
    const [parseErrorKey, setParseErrorKey] = useState<string | null>(null);
    const [parsed, setParsed] = useState<SplitwiseParseSuccess | null>(null);
    const [groupName, setGroupName] = useState('');
    const [selfMemberName, setSelfMemberName] = useState('');
    const [guestNames, setGuestNames] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);

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

        const firstMember = result.members[0] ?? '';
        setFileName(picked.fileName);
        setParsed(result);
        setGroupName(groupNameFromFileName(picked.fileName));
        setSelfMemberName(firstMember);
        setGuestNames(defaultGuestDisplayNames(result.members, firstMember));
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

    const handleSelectSelfMember = useCallback(
        (member: string) => {
            if (!parsed) return;
            setSelfMemberName(member);
            setGuestNames(defaultGuestDisplayNames(parsed.members, member));
        },
        [parsed],
    );

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
                toast: {
                    titleKey: 'splitwiseImport.title',
                    messageKey: 'splitwiseImport.errors.import_failed',
                },
            });
        } finally {
            setImporting(false);
        }
    }, [parsed, selfMemberName, guestNames, groupName, navigation, t]);

    const resetToPick = useCallback(() => {
        setStep('pick');
        setParsed(null);
    }, []);

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

    let body: React.ReactNode = <SplitwiseImportPickPanel />;
    if (step === 'preview' && parsed) {
        body = (
            <SplitwiseImportPreviewPanel
                fileName={fileName}
                parsed={parsed}
                previewSummary={previewSummary}
                groupName={groupName}
                onGroupNameChange={setGroupName}
                selfMemberName={selfMemberName}
                onSelectSelfMember={handleSelectSelfMember}
                guestNames={guestNames}
                onGuestNameChange={(member, value) =>
                    setGuestNames((prev) => ({ ...prev, [member]: value }))
                }
                onChangeFile={resetToPick}
            />
        );
    }

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
            {body}
        </CreateGroupFormShell>
    );
}
