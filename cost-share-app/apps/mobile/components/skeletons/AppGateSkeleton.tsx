import React from 'react';
import { Platform, View } from 'react-native';
import { AppLogoAnimated } from '../AppLogoAnimated';

// Match the previous static-splash footprint so the hand-off from the native
// splash to this screen is visually seamless (same logo, same white field).
const LOGO_SIZE = Platform.OS === 'ios' ? 216 : 200;

/**
 * Boot / loading gate. Shown from app launch until `isReady` (see App.tsx) and
 * on web during load. Renders the animated KupaPay brand mark (the "Transfer
 * Loop") so the loading screen carries the brand animation instead of a static
 * pulse. AppLogoAnimated falls back to the assembled mark when the OS "reduce
 * motion" setting is on.
 */
export function AppGateSkeleton() {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <AppLogoAnimated size={LOGO_SIZE} testID="app-gate-skeleton-logo" />
        </View>
    );
}
