/**
 * Pins create-group CTAs just above the screen bottom (same offset on list + form).
 * Tab stacks already lay out above the tab bar — do not add tab bar height here.
 */

import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import {
    CREATE_GROUP_FAB_ABOVE_BOTTOM_GAP,
    CREATE_GROUP_FAB_HEIGHT,
} from './CreateGroupFloatingButton';

/** Extra scroll padding so list/form content clears the floating pill. */
export const CREATE_GROUP_FAB_SCROLL_GAP = 8;

type Props = {
    children: React.ReactNode;
    /** Full-screen flows without a tab bar (e.g. onboarding) — safe-area bottom only. */
    extraBottomInset?: number;
    style?: ViewStyle;
};

export function CreateGroupFabAnchor({
    children,
    extraBottomInset = 0,
    style,
}: Props) {
    return (
        <View
            pointerEvents="box-none"
            style={[
                styles.anchor,
                { bottom: extraBottomInset + CREATE_GROUP_FAB_ABOVE_BOTTOM_GAP },
                style,
            ]}
        >
            {children}
        </View>
    );
}

export function createGroupFabScrollPadding(extraBottomInset = 0): number {
    return (
        CREATE_GROUP_FAB_HEIGHT +
        extraBottomInset +
        CREATE_GROUP_FAB_ABOVE_BOTTOM_GAP +
        CREATE_GROUP_FAB_SCROLL_GAP
    );
}

const styles = StyleSheet.create({
    anchor: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
});
