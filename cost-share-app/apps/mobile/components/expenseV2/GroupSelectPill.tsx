/**
 * GroupSelectPill — compact, tappable group control shown at the top of the
 * Add Expense hero. Shows the current group (avatar + name); tapping opens the
 * group picker sheet so the target group can be switched from within the screen.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GroupType } from '@cost-share/shared';
import { Text } from '../AppText';
import { GroupAvatar } from '../GroupAvatar';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';
import { useRtlLayout, rtlRowStyle } from '../../hooks/useRtlLayout';

interface GroupSelectPillProps {
    groupName: string;
    groupType?: GroupType;
    imageUrl?: string | null;
    onPress: () => void;
}

export function GroupSelectPill({
    groupName,
    groupType,
    imageUrl,
    onPress,
}: GroupSelectPillProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    return (
        <TouchableOpacity
            testID="add-expense-group-pill"
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('expenses.v2.changeGroup')}
            style={[styles.pill, rtlRowStyle(isRtl)]}
        >
            <GroupAvatar imageUrl={imageUrl} groupType={groupType} size="sm" />
            <View style={styles.textWrap}>
                <Text style={styles.eyebrow}>{t('expenses.v2.changeGroup')}</Text>
                <Text style={styles.name} numberOfLines={1}>
                    {groupName}
                </Text>
            </View>
            <AppIcon name="chevron-down" size={16} color={colors.gray400} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: {
        alignItems: 'center',
        alignSelf: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: colors.gray50,
        borderWidth: 1,
        borderColor: colors.border.default,
        maxWidth: '90%',
    },
    textWrap: {
        marginHorizontal: 8,
        minWidth: 0,
        flexShrink: 1,
    },
    eyebrow: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: colors.text.tertiary,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
    },
});
