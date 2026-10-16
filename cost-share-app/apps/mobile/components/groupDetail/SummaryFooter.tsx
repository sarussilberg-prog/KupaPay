/**
 * SummaryFooter — bottom region of GroupSummaryCard.
 * "N payments to settle" on the left; Note + Settle-up pills on the right.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { rtlRowStyle, useRtlLayout } from '../../hooks/useRtlLayout';
import { colors } from '../../theme';

// Design tokens not in theme/colors.ts — use literal slate-200 / slate-100 values.
const BORDER_CARD = '#E2E8F0'; // slate-200; design "border.card"
const BORDER_SOFT = '#F1F5F9'; // slate-100; design "border.soft"

interface SummaryFooterProps {
    settlementCount: number;
    onOpenNote: () => void;
    onOpenSettleUp: () => void;
    noteHasUnread?: boolean;
}

export function SummaryFooter({
    settlementCount,
    onOpenNote,
    onOpenSettleUp,
    noteHasUnread,
}: SummaryFooterProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View style={[styles.row, rtlRowStyle(isRtl)]}>
            <Text
                className="text-[12px] text-gray-500"
                style={styles.statusText}
                numberOfLines={2}
            >
                {settlementCount === 0
                    ? t('groups.summary.noOpenPayments')
                    : t('balances.paymentsToSettle', { count: settlementCount })}
            </Text>

            <View style={styles.pillGroup} testID="summary-pill-group">
                <TouchableOpacity
                    onPress={onOpenNote}
                    activeOpacity={0.7}
                    testID="summary-note-pill"
                    style={styles.notePill}
                >
                    <AppIcon
                        name="receipt-outline"
                        size={13}
                        color={colors.gray700}
                    />
                    <Text
                        className="text-[12px] font-semibold"
                        style={{ color: colors.gray700 }}
                    >
                        {t('groups.actions.note')}
                    </Text>
                    {noteHasUnread ? (
                        <View
                            style={[
                                styles.noteUnreadDot,
                                isRtl ? styles.noteUnreadDotRtl : styles.noteUnreadDotLtr,
                            ]}
                            testID="summary-note-unread-dot"
                        />
                    ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onOpenSettleUp}
                    activeOpacity={0.7}
                    testID="group-detail-settle-up"
                    style={[
                        styles.settlePill,
                        { backgroundColor: colors.primaryExtraLight },
                    ]}
                >
                    <Text
                        className="text-[12px] font-semibold"
                        style={{ color: colors.primaryDark }}
                    >
                        {t('groups.actions.settleUp')}
                    </Text>
                    <AppIcon
                        name={isRtl ? 'arrow-back' : 'arrow-forward'}
                        size={12}
                        color={colors.primaryDark}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        marginHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: BORDER_SOFT,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    statusText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    pillGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        // Keep Note immediately left of Settle-up in RTL (avoid Note floating between
        // the status copy and the settle pill when the row mirrors).
        direction: 'ltr',
    },
    notePill: {
        backgroundColor: '#fff',
        borderColor: BORDER_CARD,
        borderWidth: 1,
        borderRadius: 9999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        position: 'relative',
    },
    noteUnreadDot: {
        position: 'absolute',
        top: -2,
        width: 9,
        height: 9,
        borderRadius: 9999,
        backgroundColor: colors.warning,
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    noteUnreadDotLtr: {
        right: -2,
    },
    noteUnreadDotRtl: {
        left: -2,
    },
    settlePill: {
        borderRadius: 9999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
});
