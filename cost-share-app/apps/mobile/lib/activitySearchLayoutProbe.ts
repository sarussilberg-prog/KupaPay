import type { LayoutRectangle } from 'react-native';

/** E2E: placeholder line should sit on the trailing edge of the pill in RTL (input box fills toward start). */
export function isActivitySearchFieldTrailingAligned(
    field: Pick<LayoutRectangle, 'x' | 'width'>,
    container: Pick<LayoutRectangle, 'width'>,
    isRtl: boolean,
    tolerance = 4,
): boolean {
    if (!isRtl) return true;
    const trailingEdge = field.x + field.width;
    return trailingEdge >= container.width - tolerance;
}
