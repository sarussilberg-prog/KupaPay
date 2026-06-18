import React, { useEffect, useRef } from 'react';
import {
    Animated as RNAnimated,
    Easing as RNEasing,
    Image,
    Platform,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import Reanimated, {
    Easing as ReEasing,
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
 * Native uses react-native-reanimated. On web, reanimated's worklet runtime does not drive the
 * loop reliably (it renders frozen), so the web build uses React Native's core `Animated` API,
 * which react-native-web animates via requestAnimationFrame. Both paths produce identical motion.
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

// Loop split as fractions of LOOP_MS: glide-in, hold assembled, accelerate-out, wait empty.
const F_ENTER = 0.26;
const F_HOLD = 0.26;
const F_EXIT = 0.28;
const F_WAIT = 0.2;

interface AppLogoAnimatedProps {
    size?: number;
    testID?: string;
    style?: StyleProp<ViewStyle>;
}

interface StageLayout {
    k: number;
    stageH: number;
    stageStyle: ViewStyle;
    topSlot: ViewStyle;
    botSlot: ViewStyle;
}

// Scale the source stage (1100×967) to the square box, centered vertically (the logo is wider
// than tall), so the animated mark sits balanced in its container.
function getStageLayout(size: number): StageLayout {
    const k = size / STAGE_W;
    const stageH = STAGE_H * k;
    const stageTop = (size - stageH) / 2;
    return {
        k,
        stageH,
        stageStyle: { position: 'absolute', left: 0, top: stageTop, width: size, height: stageH },
        topSlot: {
            position: 'absolute',
            left: TOP_SLOT.left * k,
            top: TOP_SLOT.top * k,
            width: TOP_SLOT.width * k,
            height: TOP_SLOT.height * k,
        },
        botSlot: {
            position: 'absolute',
            left: BOT_SLOT.left * k,
            top: BOT_SLOT.top * k,
            width: BOT_SLOT.width * k,
            height: BOT_SLOT.height * k,
        },
    };
}

export function AppLogoAnimated(props: AppLogoAnimatedProps) {
    // Platform.OS is fixed for the app's lifetime, so this branch is stable and each platform's
    // component keeps a consistent hook order across renders.
    if (Platform.OS === 'web') {
        return <AppLogoAnimatedWeb {...props} />;
    }
    return <AppLogoAnimatedNative {...props} />;
}

function AppLogoAnimatedNative({ size = 108, testID = 'app-logo', style }: AppLogoAnimatedProps) {
    const reduced = useReducedMotion();
    const { k, stageH, stageStyle, topSlot, botSlot } = getStageLayout(size);

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
        const enter = ReEasing.bezier(0.16, 0.86, 0.28, 1);
        const exit = ReEasing.bezier(0.55, 0, 0.82, 0.18);
        const linear = ReEasing.linear;

        // Top arrow (→): wait off-left, glide in to the logo, hold, accelerate out to the right,
        // wait off-right, then snap back off-left (invisible, behind the clip) and loop.
        topX.value = withRepeat(
            withSequence(
                withTiming(TOP_ENTER * k, { duration: 0 }),
                withTiming(0, { duration: F_ENTER * d, easing: enter }),
                withTiming(0, { duration: F_HOLD * d, easing: linear }),
                withTiming(TOP_EXIT * k, { duration: F_EXIT * d, easing: exit }),
                withTiming(TOP_EXIT * k, { duration: F_WAIT * d, easing: linear }),
            ),
            -1,
        );
        // Bottom arrow (←): mirror — in from the right, hold, out to the left, loop.
        botX.value = withRepeat(
            withSequence(
                withTiming(BOT_ENTER * k, { duration: 0 }),
                withTiming(0, { duration: F_ENTER * d, easing: enter }),
                withTiming(0, { duration: F_HOLD * d, easing: linear }),
                withTiming(BOT_EXIT * k, { duration: F_EXIT * d, easing: exit }),
                withTiming(BOT_EXIT * k, { duration: F_WAIT * d, easing: linear }),
            ),
            -1,
        );
    }, [reduced, k, topX, botX]);

    const topStyle = useAnimatedStyle(() => ({ transform: [{ translateX: topX.value }] }));
    const botStyle = useAnimatedStyle(() => ({ transform: [{ translateX: botX.value }] }));

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
                    <Reanimated.View style={[topSlot, topStyle]}>
                        <Image source={ARROW_TOP} style={styles.full} resizeMode="contain" />
                    </Reanimated.View>
                    <Reanimated.View style={[botSlot, botStyle]}>
                        <Image source={ARROW_BOTTOM} style={styles.full} resizeMode="contain" />
                    </Reanimated.View>
                </View>
            </View>
        </View>
    );
}

function AppLogoAnimatedWeb({ size = 108, testID = 'app-logo', style }: AppLogoAnimatedProps) {
    const { k, stageH, stageStyle, topSlot, botSlot } = getStageLayout(size);
    const reduced = prefersReducedMotionWeb();

    const topX = useRef(new RNAnimated.Value(reduced ? 0 : TOP_ENTER * k)).current;
    const botX = useRef(new RNAnimated.Value(reduced ? 0 : BOT_ENTER * k)).current;

    useEffect(() => {
        if (reduced) {
            topX.setValue(0);
            botX.setValue(0);
            return;
        }
        const d = LOOP_MS;
        const enter = RNEasing.bezier(0.16, 0.86, 0.28, 1);
        const exit = RNEasing.bezier(0.55, 0, 0.82, 0.18);
        const linear = RNEasing.linear;

        // Each loop: snap to the off-screen start (duration 0), glide in, hold, accelerate out,
        // wait off-screen. useNativeDriver is false because web has no native driver — RNW drives
        // the translateX via requestAnimationFrame.
        const makeLoop = (val: RNAnimated.Value, enterPos: number, exitPos: number) =>
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(val, { toValue: enterPos, duration: 0, useNativeDriver: false }),
                    RNAnimated.timing(val, { toValue: 0, duration: F_ENTER * d, easing: enter, useNativeDriver: false }),
                    RNAnimated.timing(val, { toValue: 0, duration: F_HOLD * d, easing: linear, useNativeDriver: false }),
                    RNAnimated.timing(val, { toValue: exitPos, duration: F_EXIT * d, easing: exit, useNativeDriver: false }),
                    RNAnimated.timing(val, { toValue: exitPos, duration: F_WAIT * d, easing: linear, useNativeDriver: false }),
                ]),
            );

        const topLoop = makeLoop(topX, TOP_ENTER * k, TOP_EXIT * k);
        const botLoop = makeLoop(botX, BOT_ENTER * k, BOT_EXIT * k);
        topLoop.start();
        botLoop.start();
        return () => {
            topLoop.stop();
            botLoop.stop();
        };
    }, [reduced, k, topX, botX]);

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
                    <RNAnimated.View style={[topSlot, { transform: [{ translateX: topX }] }]}>
                        <Image source={ARROW_TOP} style={styles.full} resizeMode="contain" />
                    </RNAnimated.View>
                    <RNAnimated.View style={[botSlot, { transform: [{ translateX: botX }] }]}>
                        <Image source={ARROW_BOTTOM} style={styles.full} resizeMode="contain" />
                    </RNAnimated.View>
                </View>
            </View>
        </View>
    );
}

function prefersReducedMotionWeb(): boolean {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    try {
        return mm ? mm('(prefers-reduced-motion: reduce)').matches : false;
    } catch {
        return false;
    }
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
