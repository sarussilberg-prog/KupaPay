/**
 * GroupSelectPill — compact group control shown at the top of the Add Expense
 * hero. A standalone "קופה" / "Group" field label sits ABOVE the tappable
 * control; the control itself shows just the current group name + a chevron.
 * Tapping opens the group picker sheet so the target group can be switched
 * from within the screen.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GroupType } from '@cost-share/shared';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface GroupSelectPillProps {
    groupName: string;
    groupType?: GroupType;
    imageUrl?: string | null;
    onPress: () => void;
}

export function GroupSelectPill({ groupName, onPress }: GroupSelectPillProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    return (
        <View style={styles.wrap}>
            <Text testID="add-expense-group-label" style={styles.label}>
                {t('expenses.v2.changeGroup')}
            </Text>
            <TouchableOpacity
                testID="add-expense-group-pill"
                onPress={onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('expenses.v2.changeGroup')}
                style={[styles.pill, rtlRowStyle(isRtl)]}
            >
                <Text style={styles.name} numberOfLines={1}>
                    {groupName}
                </Text>
                <AppIcon name="chevron-down" size={16} color={colors.gray400} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        alignSelf: 'center',
        maxWidth: '90%',
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: colors.text.tertiary,
        textAlign: 'center',
        marginBottom: 4,
    },
    pill: {
        alignItems: 'center',
        alignSelf: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: colors.gray50,
        borderWidth: 1,
        borderColor: colors.border.default,
        maxWidth: '100%',
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginHorizontal: 6,
    },
});
