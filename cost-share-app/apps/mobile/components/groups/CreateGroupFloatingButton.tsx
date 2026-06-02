/**
 * Compact floating primary CTA for create-group flows (form footer + groups list).
 */

import React from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from '../AppText';
import { AppIcon, type AppIconName } from '../AppIcon';
import { colors } from '../../theme';

/** Approximate pill height (paddingVertical 14×2 + label). */
export const CREATE_GROUP_FAB_HEIGHT = 50;

/** Gap between the pill and the bottom edge (tab bar top or safe-area bottom). */
export const CREATE_GROUP_FAB_ABOVE_BOTTOM_GAP = 2;

type Props = {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    testID?: string;
    icon?: AppIconName;
};

export function CreateGroupFloatingButton({
    title,
    onPress,
    loading = false,
    disabled = false,
    testID,
    icon,
}: Props) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            disabled={isDisabled}
            accessibilityRole="button"
            testID={testID}
            style={[styles.fab, isDisabled && styles.fabDisabled]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
            ) : (
                <View style={styles.labelRow}>
                    {icon ? (
                        <AppIcon name={icon} size={22} color={colors.white} />
                    ) : null}
                    <Text style={[styles.label, icon ? styles.labelWithIcon : null]}>
                        {title}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        paddingHorizontal: 22,
        paddingVertical: 14,
        borderRadius: 28,
        backgroundColor: colors.primary,
        maxWidth: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 10,
            },
            android: { elevation: 6 },
            default: {},
        }),
    },
    fabDisabled: {
        opacity: 0.5,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.white,
        flexShrink: 1,
    },
    labelWithIcon: {
        marginStart: 8,
    },
});
