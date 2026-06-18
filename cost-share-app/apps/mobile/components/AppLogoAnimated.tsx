import React, { useEffect } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

/**
 * Animated KupaPay brand mark for the login screen.
 *
 * This is a 1:1 port of the approved "Transfer Loop" animation (designed in Claude Design):
 * three raster layers — the empty teal wallet (base) plus the two white transfer arrows. The top
 * arrow (→) slides in from the left and the bottom arrow (←) from the right; they meet to assemble
 * the complete logo, hold, then keep going and exit out the far side, leaving the empty wallet for
 * a beat before looping. The arrows are clipped to the stage, so they appear to emerge from /
 * disappear into the wallet's edges (no fade).
 *
 * Geometry, timing and easing are taken verbatim from the source HTML:
 *   stage 1100×967; arrow slots 792×323 at (0,247) and (308,518); loop 3.6s;
 *   flowTop X: -900 → 0 → 0 → +1200; flowBot X: +900 → 0 → 0 → -1200 (px in stage units),
 *   ease-in glide-in (.16,.86,.28,1) and accelerate-out (.55,0,.82,.18).
 *
 * Respects the OS "reduce motion" setting by rendering the assembled logo statically.
 */

const WALLET_BASE = require('../assets/brand/anim/wallet-base.png');
const ARROW_TOP = require('../assets/brand/anim/arrow-top.png');
const ARROW_BOTTOM = require('../assets/brand/anim/arrow-bottom.png');

// Source stage + layer geometry (px), straight from the approved HTML.
const STAGE_W = 1100;
const STAGE_H = 967;
const TOP_SLOT = { left: 0, top: 247, width: 792, height: 323 };
const BOT_SLOT = { left: 308, top: 518, width: 792, height: 323 };
const TOP_ENTER = -900;
const TOP_EXIT = 1200;
const BOT_ENTER = 900;
const BOT_EXIT = -1200;

const LOOP_MS = 3600;

interface AppLogoAnimatedProps {
    size?: number;
    testID?: string;
    style?: StyleProp<ViewStyle>;
}

export function AppLogoAnimated({
    size = 108,
    testID = 'app-logo',
    style,
}: AppLogoAnimatedProps) {
    const reduced = useReducedMotion();

    // Scale the source stage (1100×967) to the square box, centered vertically (the logo is
    // wider than tall), so the animated mark sits balanced in its container.
    const k = size / STAGE_W;
    const stageH = STAGE_H * k;
    const stageTop = (size - stageH) / 2;

    const topX = useSharedValue(reduced ? 0 : TOP_ENTER * k);
    const botX = useSharedValue(reduced ? 0 : BOT_ENTER * k);

    useEffect(() => {
        if (reduced) {
            topX.value = 0;
            botX.value = 0;
            return;
        }
        const d = LOOP_MS;
        // Approved easings: glide-in (fast then settle) and accelerate-out.
        const enter = Easing.bezier(0.16, 0.86, 0.28, 1);
        const exit = Easing.bezier(0.55, 0, 0.82, 0.18);
        const linear = Easing.linear;

        // Top arrow (→): wait off-left, glide in to the logo, hold, accelerate out to the right,
        // wait off-right, then snap back off-left (invisible, behind the clip) and loop.
        topX.value = withRepeat(
            withSequence(
                withTiming(TOP_ENTER * k, { duration: 0 }),
                withTiming(0, { duration: 0.26 * d, easing: enter }),
                withTiming(0, { duration: 0.26 * d, easing: linear }),
                withTiming(TOP_EXIT * k, { duration: 0.28 * d, easing: exit }),
                withTiming(TOP_EXIT * k, { duration: 0.2 * d, easing: linear }),
            ),
            -1,
        );
        // Bottom arrow (←): mirror — in from the right, hold, out to the left, loop.
        botX.value = withRepeat(
            withSequence(
                withTiming(BOT_ENTER * k, { duration: 0 }),
                withTiming(0, { duration: 0.26 * d, easing: enter }),
                withTiming(0, { duration: 0.26 * d, easing: linear }),
                withTiming(BOT_EXIT * k, { duration: 0.28 * d, easing: exit }),
                withTiming(BOT_EXIT * k, { duration: 0.2 * d, easing: linear }),
            ),
            -1,
        );
    }, [reduced, k, topX, botX]);

    const topStyle = useAnimatedStyle(() => ({ transform: [{ translateX: topX.value }] }));
    const botStyle = useAnimatedStyle(() => ({ transform: [{ translateX: botX.value }] }));

    const stageStyle: ViewStyle = {
        position: 'absolute',
        left: 0,
        top: stageTop,
        width: size,
        height: stageH,
    };
    const topSlot: ViewStyle = {
        position: 'absolute',
        left: TOP_SLOT.left * k,
        top: TOP_SLOT.top * k,
        width: TOP_SLOT.width * k,
        height: TOP_SLOT.height * k,
    };
    const botSlot: ViewStyle = {
        position: 'absolute',
        left: BOT_SLOT.left * k,
        top: BOT_SLOT.top * k,
        width: BOT_SLOT.width * k,
        height: BOT_SLOT.height * k,
    };

    return (
        <View
            style={[styles.wrap, { width: size, height: size }, style]}
            testID={testID}
            accessibilityLabel="KupaPay"
            accessibilityRole="image"
        >
            <View style={stageStyle}>
                <Image
                    source={WALLET_BASE}
                    style={{ width: size, height: stageH }}
                    resizeMode="contain"
                />
                <View style={styles.fill} pointerEvents="none">
                    <Animated.View style={[topSlot, topStyle]}>
                        <Image source={ARROW_TOP} style={styles.full} resizeMode="contain" />
                    </Animated.View>
                    <Animated.View style={[botSlot, botStyle]}>
                        <Image source={ARROW_BOTTOM} style={styles.full} resizeMode="contain" />
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
        overflow: 'hidden',
    },
    // The arrows live in a layer clipped to the stage, so they vanish at the wallet's edges.
    fill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
    },
    full: {
        width: '100%',
        height: '100%',
    },
});
