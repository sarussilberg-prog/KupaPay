import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

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
});
