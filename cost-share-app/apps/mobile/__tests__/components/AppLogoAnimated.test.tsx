import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('../../lib/appIconVariant', () => ({
    shouldUseLiquidGlassAppIcon: jest.fn(() => true),
}));

const GLASS_LOGO = require('../../assets/icon-glass.png');
const WALLET_BASE = require('../../assets/brand/anim/wallet-base.png');
const ARROW_TOP = require('../../assets/brand/anim/arrow-top.png');
const ARROW_BOTTOM = require('../../assets/brand/anim/arrow-bottom.png');

function imageSources(root: ReturnType<typeof render>['UNSAFE_root']) {
    return root
        .findAllByType(Image)
        .map((node: { props: { source?: unknown } }) => node.props.source)
        .filter(Boolean);
}

// reanimated v4 needs the native worklets module; in jest we mock it so the
// component renders statically (the project mocks reanimated-backed components
// in screen tests — here we mock the library to exercise the real SVG output).
jest.mock('react-native-reanimated', () => {
    const React = require('react');
    const { View } = require('react-native');
    const easing = () => 0;
    return {
        __esModule: true,
        default: { View },
        Easing: {
            out: () => easing,
            in: () => easing,
            cubic: easing,
            linear: easing,
            bezier: () => easing,
        },
        useAnimatedStyle: (fn: () => unknown) => {
            try {
                return fn();
            } catch {
                return {};
            }
        },
        useReducedMotion: () => false,
        useSharedValue: (v: unknown) => ({ value: v }),
        withRepeat: (v: unknown) => v,
        withSequence: (...args: unknown[]) => args[args.length - 1],
        withTiming: (v: unknown) => v,
    };
});

import { AppLogoAnimated } from '../../components/AppLogoAnimated';

describe('AppLogoAnimated', () => {
    it('renders with the default app-logo testID and KupaPay label', () => {
        const { getByTestId, getByLabelText } = render(<AppLogoAnimated />);
        expect(getByTestId('app-logo')).toBeTruthy();
        expect(getByLabelText('KupaPay')).toBeTruthy();
    });

    it('honors a custom testID', () => {
        const { getByTestId } = render(<AppLogoAnimated testID="hero-logo" />);
        expect(getByTestId('hero-logo')).toBeTruthy();
    });

    it('renders in a square box clipped to size', () => {
        const { getByTestId } = render(<AppLogoAnimated size={120} />);
        const flat = StyleSheet.flatten(getByTestId('app-logo').props.style);
        expect(flat.width).toBe(120);
        expect(flat.height).toBe(120);
        expect(flat.overflow).toBe('hidden');
    });

    it('always renders the transparent animated layers even when liquid-glass app icon is active', () => {
        const view = render(<AppLogoAnimated />);
        const sources = imageSources(view.UNSAFE_root);
        expect(sources).toContainEqual(WALLET_BASE);
        expect(sources).toContainEqual(ARROW_TOP);
        expect(sources).toContainEqual(ARROW_BOTTOM);
        expect(sources).not.toContainEqual(GLASS_LOGO);
    });
});
