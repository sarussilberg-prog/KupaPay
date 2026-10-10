import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CenterDialogShell } from '../CenterDialogShell';
import { Text } from '../AppText';

export type GroupExportFormat = 'csv' | 'pdf' | 'excel';

interface GroupExportSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (format: GroupExportFormat) => void;
    proLocked: boolean;
    onUpgrade: () => void;
}

export function GroupExportSheet({
    visible,
    onClose,
    onSelect,
    proLocked,
    onUpgrade,
}: GroupExportSheetProps) {
    const { t } = useTranslation();

    const pick = (format: GroupExportFormat) => {
        if (proLocked && format !== 'csv') {
            onUpgrade();
            return;
        }
        onSelect(format);
        onClose();
    };

    return (
        <CenterDialogShell visible={visible} onClose={onClose} label={t('groups.share.exportTitle')}>
            <View className="gap-2 px-2 pb-4">
                <ExportRow label={t('groups.share.exportCsv')} onPress={() => pick('csv')} />
                <ExportRow
                    label={t('groups.share.exportPdf')}
                    badge={proLocked ? t('pro.badge') : undefined}
                    onPress={() => pick('pdf')}
                />
                <ExportRow
                    label={t('groups.share.exportExcel')}
                    badge={proLocked ? t('pro.badge') : undefined}
                    onPress={() => pick('excel')}
                />
            </View>
        </CenterDialogShell>
    );
}

function ExportRow({
    label,
    onPress,
    badge,
}: {
    label: string;
    onPress: () => void;
    badge?: string;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="py-3 px-3 rounded-xl bg-slate-50 flex-row items-center justify-between"
        >
            <Text className="text-base text-gray-900">{label}</Text>
            {badge ? (
                <Text className="text-xs font-bold text-primary bg-blue-50 px-2 py-1 rounded-md">
                    {badge}
                </Text>
            ) : null}
        </TouchableOpacity>
    );
}
