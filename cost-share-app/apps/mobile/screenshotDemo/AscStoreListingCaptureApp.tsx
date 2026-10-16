import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RtlLayoutProvider } from '../hooks/useRtlLayout';
import { AscStoreListingCaptureRoot } from './AscStoreListingCaptureRoot';

/** Lightweight root for Playwright / store screenshots (no Supabase session boot). */
export default function AscStoreListingCaptureApp() {
    return (
        <SafeAreaProvider>
            <RtlLayoutProvider>
                <AscStoreListingCaptureRoot />
            </RtlLayoutProvider>
        </SafeAreaProvider>
    );
}
