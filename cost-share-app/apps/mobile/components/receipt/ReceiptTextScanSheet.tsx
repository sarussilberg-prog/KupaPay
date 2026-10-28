import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button } from '../Button';
import { useTranslation } from 'react-i18next';
import type { ReceiptDraft } from '@cost-share/shared';
import { BottomSheetShell } from '../BottomSheetShell';
import { Text } from '../AppText';
import { parseReceiptLocally } from '../../services/receiptOcr.service';
import { captureProductEvent } from '../../lib/productAnalytics';
import { rtlTextClassName, useRtlLayout } from '../../hooks/useRtlLayout';

interface ReceiptTextScanSheetProps {
    visible: boolean;
    onClose: () => void;
    onApply: (draft: ReceiptDraft) => void;
}

export function ReceiptTextScanSheet({ visible, onClose, onApply }: ReceiptTextScanSheetProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const [text, setText] = useState('');

    const handleApply = () => {
        const draft = parseReceiptLocally(text);
        void captureProductEvent('receipt_scan_applied', {
            has_amount: draft.amount != null,
            confidence: draft.confidence,
        });
        onApply(draft);
        setText('');
        onClose();
    };

    return (
        <BottomSheetShell visible={visible} onClose={onClose} label={t('pro.receiptOcr.sheetTitle')}>
            <View className="px-4 pb-6" testID="bottom-sheet-body">
            <Text className="text-gray-600 text-sm mb-3">{t('pro.receiptOcr.sheetBody')}</Text>
            <TextInput
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={6}
                placeholder={t('pro.receiptOcr.placeholder')}
                className={[
                    'border border-gray-200 rounded-xl px-3 py-3 mb-4 text-gray-900 min-h-[120px]',
                    rtlTextClassName(isRtl),
                ]
                    .filter(Boolean)
                    .join(' ')}
                textAlignVertical="top"
            />
            <Button
                title={t('pro.receiptOcr.apply')}
                onPress={handleApply}
                disabled={text.trim().length === 0}
                variant="pro"
                testID="receipt-text-apply"
            />
            </View>
        </BottomSheetShell>
    );
}
