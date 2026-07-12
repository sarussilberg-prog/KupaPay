/**
 * UnreadBadge — small pill showing an unread activity count.
 * Shared by the Activity bottom-tab icon and each GroupCard on the Groups list.
 * Renders nothing when count <= 0; clamps counts over 99 to "99+".
 */

import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Text } from './AppText';
import { colors } from '../theme';

interface UnreadBadgeProps {
    count: number;
    /** Extra positioning (e.g. absolute placement over the tab icon). */
    style?: StyleProp<ViewStyle>;
}

export function UnreadBadge({ count, style }: UnreadBadgeProps) {
    if (count <= 0) return null;
    return (
        <View
            testID="unread-badge"
            style={[
                {
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: colors.primaryExtraLight,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                style,
            ]}
        >
            <Text
                style={{
                    color: colors.primaryDark,
                    fontSize: 10,
                    fontWeight: '600',
                    lineHeight: 12,
                }}
            >
                {count > 99 ? '99+' : count}
            </Text>
        </View>
    );
}
