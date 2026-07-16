/**
 * Floating message action pinned above the tab bar.
 * Expense creation uses the center tab "+" (derived group context).
 *
 * Anchored to the physical START side (left in LTR layout coords) in both
 * Hebrew and English — do not flip with RTL.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';

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

    return (
        <View
            pointerEvents="box-none"
            style={[styles.container, { bottom: FAB_BOTTOM_GAP }]}
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
        left: 16,
        right: 16,
        flexDirection: 'row',
        // Physical left in both HE and EN (message used to sit opposite the
        // expense FAB on the right).
        justifyContent: 'flex-start',
        alignItems: 'center',
        direction: 'ltr',
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
