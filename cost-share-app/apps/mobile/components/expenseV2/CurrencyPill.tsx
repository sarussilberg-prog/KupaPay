import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

interface CurrencyPillProps {
    currency: string;
    onPress: () => void;
    testID?: string;
}

/** Compact currency selector — StyleSheet only (no NativeWind) so it always paints. */
export function CurrencyPill({ currency, onPress, testID = 'currency-pill' }: CurrencyPillProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={currency}
            style={styles.pill}
        >
            <Text style={styles.code}>{currency}</Text>
            <AppIcon name="chevron-down" size={14} color={colors.primaryDark} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primaryExtraLight ?? '#DBEAFE',
        borderRadius: 9999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 4,
        flexShrink: 0,
    },
    code: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.4,
        color: colors.primaryDark,
    },
});
