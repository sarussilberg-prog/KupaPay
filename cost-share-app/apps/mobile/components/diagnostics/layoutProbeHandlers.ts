import type { LayoutChangeEvent } from 'react-native';
import { isE2eLayoutProbeEnabled } from '../../lib/e2eLayoutProbes';
import { recordLayoutProbe, type LayoutProbeId } from '../../lib/groupsLayoutDiagnostics';

export function layoutProbeOnLayout(id: LayoutProbeId) {
    if (!isE2eLayoutProbeEnabled()) return undefined;
    return (event: LayoutChangeEvent) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        recordLayoutProbe(id, { x, y, width, height });
    };
}
