import { Dimensions } from 'react-native';

const PREVIEW_HEIGHT = 780;

/** Align useWindowDimensions() with the B2 preview frame width (Playwright viewport). */
export function syncGroupsListPreviewDimensions(viewportWidth: number): void {
    const dims = {
        width: viewportWidth,
        height: PREVIEW_HEIGHT,
        scale: 2,
        fontScale: 1,
    };
    Dimensions.set({ window: dims, screen: dims });
}
