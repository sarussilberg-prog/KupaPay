import React, { useEffect } from 'react';
import type { AscCaptureScreen } from '../lib/ascCaptureParams';
import { navigateAscCaptureScreen } from '../lib/ascCaptureNavigate';
import { rootNavigationRef } from '../lib/rootNavigationRef';

type Props = {
    screen: AscCaptureScreen;
    onReady: () => void;
};

/** Waits for the root navigator, jumps to the listing screen, then signals ready. */
export function AscCaptureNavigationController({ screen, onReady }: Props) {
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const tick = () => {
            if (cancelled) return;
            attempts += 1;
            if (rootNavigationRef.isReady()) {
                navigateAscCaptureScreen(screen);
                globalThis.setTimeout(() => {
                    if (!cancelled) onReady();
                }, 900);
                return;
            }
            if (attempts < 600) {
                requestAnimationFrame(tick);
            }
        };

        tick();
        return () => {
            cancelled = true;
        };
    }, [screen, onReady]);

    return null;
}
