/**
 * Floating message action pinned above the tab bar.
 * Expense creation uses the center tab "+" (derived group context).
 *
 * Anchored to the layout start edge (mirrors with app RTL).
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';
import { rtlRowStyle, useRtlLayout } from '../hooks/useRtlLayout';

/** Gap between FAB row and tab bar (px). */
export const FAB_BOTTOM_GAP = 6;

/** Extra scroll padding below the FAB row (px). */
export const FAB_LIST_GAP = 8;

/** Approximate height of one FAB pill — used for list scroll padding. */
export const FAB_ROW_HEIGHT = 48;

interface GroupDetailFloatingActionsProps {
    onMessage: () => void;
}

export function GroupDetailFloatingActions({
    onMessage,
}: GroupDetailFloatingActionsProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <View
            pointerEvents="box-none"
            style={[styles.container, rtlRowStyle(isRtl), { bottom: FAB_BOTTOM_GAP }]}
        >
            <TouchableOpacity
                onPress={onMessage}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('groups.actions.message')}
                style={[styles.fab, styles.fabMessage]}
                testID="detail-message-btn"
            >
                <AppIcon name="chatbubble-outline" size={24} color={colors.primary} />
                <Text style={styles.fabLabelMessage}>{t('groups.actions.message')}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        start: 16,
        end: 16,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 28,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.14,
                shadowRadius: 8,
            },
            android: { elevation: 6 },
            default: {},
        }),
    },
    fabMessage: {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
    },
    fabLabelMessage: {
        marginStart: 8,
        fontSize: 15,
        fontWeight: '600',
        color: colors.primaryDark,
    },
});
