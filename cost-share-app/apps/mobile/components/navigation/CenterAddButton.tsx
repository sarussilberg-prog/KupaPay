/**
 * CenterAddButton — the raised primary-gradient "+" FAB that sits in the
 * middle of the custom tab bar, lifted slightly above it. Presentational
 * only: the tab bar owns the navigation side-effect.
 */
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

/** Diameter of the raised FAB (px). */
export const CENTER_ADD_SIZE = 58;
/** How far the FAB is lifted above the tab bar's top edge (px). */
export const CENTER_ADD_LIFT = 18;

interface CenterAddButtonProps {
    onPress: () => void;
}

export function CenterAddButton({ onPress }: CenterAddButtonProps) {
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('expenses.v2.addQuick')}
            testID="center-add-button"
            style={styles.touchable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <LinearGradient
                colors={[colors.primaryLight, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.iconWrap}>
                    <AppIcon name="add" size={32} color={colors.white} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touchable: {
        width: CENTER_ADD_SIZE,
        height: CENTER_ADD_SIZE,
        borderRadius: CENTER_ADD_SIZE / 2,
        // Lift above the bar; the tab bar reserves this space via marginTop.
        marginTop: -CENTER_ADD_LIFT,
        ...Platform.select({
            ios: {
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.22,
                shadowRadius: 8,
            },
            android: { elevation: 8 },
            default: {},
        }),
    },
    gradient: {
        flex: 1,
        borderRadius: CENTER_ADD_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.white,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
