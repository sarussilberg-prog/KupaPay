import { E2E_MAESTRO_AUTH_ENABLED } from './featureFlags';

/** Maestro-visible probes only in CI/E2E builds — zero UI impact in production. */
export function isE2eLayoutProbeEnabled(): boolean {
    return E2E_MAESTRO_AUTH_ENABLED;
}

/** Horizontal inset (list padding) + small tolerance for card shadow rounding. */
export function minFullBleedCardWidth(windowWidth: number, horizontalInset = 16): number {
    return windowWidth - horizontalInset * 2 - 2;
}

export function isWidthAtLeastFullBleed(
    measuredWidth: number,
    windowWidth: number,
    horizontalInset = 16,
): boolean {
    return measuredWidth >= minFullBleedCardWidth(windowWidth, horizontalInset);
}

/** Label layout is relative to the button parent (RN onLayout). */
export function isLabelInsideButton(
    button: { width: number; height: number },
    label: { width: number; height: number; x: number; y: number },
    pad = 2,
): boolean {
    return (
        label.x >= -pad &&
        label.y >= -pad &&
        label.x + label.width <= button.width + pad &&
        label.y + label.height <= button.height + pad &&
        label.width <= button.width + pad
    );
}
