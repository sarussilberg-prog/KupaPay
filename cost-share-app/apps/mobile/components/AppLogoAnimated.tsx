import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Image,
    Platform,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Animated KupaPay brand mark for the login screen.
 *
 * 1:1 port of the approved "Transfer Loop" animation (designed in Claude Design): three raster
 * layers — the empty teal wallet (base) plus the two white transfer arrows. The top arrow (→)
 * slides in from the left and the bottom arrow (←) from the right; they meet to assemble the
 * complete logo, hold, then keep going and exit out the far side, leaving the empty wallet for a
 * beat before looping. The arrows are clipped to the stage, so they appear to emerge from /
 * disappear into the wallet's edges (no fade).
 *
 * Geometry, timing and easing are taken verbatim from the source HTML:
 *   stage 1100×967; arrow slots 792×323 at (0,247) and (308,518); loop 3.6s;
 *   flowTop X: -900 → 0 → 0 → +1200; flowBot X: +900 → 0 → 0 → -1200 (px in stage units),
 *   glide-in (.16,.86,.28,1) and accelerate-out (.55,0,.82,.18).
 *
 * Both platforms run on React Native's core `Animated` API so the motion is identical everywhere:
 * native uses the native driver (UI thread, 60fps); web has no native driver, so react-native-web
 * drives translateX via requestAnimationFrame. A single engine matters here — an earlier
 * reanimated implementation paused the loop on a different keyframe on iOS (arrow heads, not tails,
 * at the wallet edge) and rendered frozen on web.
 *
 * RTL: the app renders right-to-left for Hebrew (RtlLayoutProvider sets the root to `direction:
 * 'rtl'`; i18n also calls I18nManager.forceRTL, so I18nManager.isRTL is true). On the New
 * Architecture layout direction is per-node, so that inherited `direction: 'rtl'` mirrored the
 * absolutely-positioned arrow slots on iOS — arrow heads landed at the wallet edges instead of
 * meeting in the middle. The fix is a single mechanism: `direction: 'ltr'` on the wrapper opts the
 * whole subtree back out of RTL, so each slot's physical `left` offset resolves to the physical
 * left in every language (verified at runtime: with isRTL true, a literal `left: 0` box still
 * renders on the left inside this subtree, so no manual left/right swap is needed). react-native-web
 * honors the same direction, which is why web was already correct. A brand mark must never mirror
 * with language direction.
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

// translateX runs on the native driver on iOS/Android (UI thread). Web has no native driver, so
// react-native-web animates it via requestAnimationFrame.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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

export function AppLogoAnimated({ size = 108, testID = 'app-logo', style }: AppLogoAnimatedProps) {
    const reduced = useReducedMotion();
    const { k, stageH, stageStyle, topSlot, botSlot } = getStageLayout(size);

    const topX = useRef(new Animated.Value(reduced ? 0 : TOP_ENTER * k)).current;
    const botX = useRef(new Animated.Value(reduced ? 0 : BOT_ENTER * k)).current;

    useEffect(() => {
        if (reduced) {
            topX.setValue(0);
            botX.setValue(0);
            return;
        }
        const d = LOOP_MS;
        // Approved easings: glide-in (fast then settle) and accelerate-out.
        const enter = Easing.bezier(0.16, 0.86, 0.28, 1);
        const exit = Easing.bezier(0.55, 0, 0.82, 0.18);
        const linear = Easing.linear;

        // Each loop: snap to the off-screen start (duration 0), glide in, hold assembled, accelerate
        // out, wait off-screen, then repeat.
        const makeLoop = (val: Animated.Value, enterPos: number, exitPos: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(val, { toValue: enterPos, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
                    Animated.timing(val, { toValue: 0, duration: F_ENTER * d, easing: enter, useNativeDriver: USE_NATIVE_DRIVER }),
                    Animated.timing(val, { toValue: 0, duration: F_HOLD * d, easing: linear, useNativeDriver: USE_NATIVE_DRIVER }),
                    Animated.timing(val, { toValue: exitPos, duration: F_EXIT * d, easing: exit, useNativeDriver: USE_NATIVE_DRIVER }),
                    Animated.timing(val, { toValue: exitPos, duration: F_WAIT * d, easing: linear, useNativeDriver: USE_NATIVE_DRIVER }),
                ]),
            );

        // Top arrow (→): in from the left, hold, out to the right. Bottom arrow (←): mirror.
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
                    <Animated.View style={[topSlot, { transform: [{ translateX: topX }] }]}>
                        <Image source={ARROW_TOP} style={styles.full} resizeMode="contain" />
                    </Animated.View>
                    <Animated.View style={[botSlot, { transform: [{ translateX: botX }] }]}>
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
        // Opt the logo out of the app's RTL. The root is `direction: 'rtl'` for Hebrew
        // (RtlLayoutProvider); on the New Architecture that inherited direction mirrors the arrows'
        // absolute `left` offsets on iOS. Forcing this subtree to LTR makes `left` resolve
        // physically again, so the mark never mirrors with language. A brand mark must never mirror.
        direction: 'ltr',
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
