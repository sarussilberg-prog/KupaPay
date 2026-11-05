import { Modal } from 'react-native';
import type { RenderAPI } from '@testing-library/react-native';

/** Count `<Modal visible>` instances in the current render tree. */
export function countVisibleModals(screen: RenderAPI): number {
    const modals = screen.UNSAFE_queryAllByType(Modal);
    return modals.filter(m => m.props.visible).length;
}

export function expectAtMostOneVisibleModal(screen: RenderAPI, context?: string): void {
    const n = countVisibleModals(screen);
    if (n > 1) {
        const open = screen
            .UNSAFE_queryAllByType(Modal)
            .filter(m => m.props.visible)
            .map(m => m.props.testID ?? '(no testID)');
        throw new Error(
            `${context ?? 'Modal guard'}: expected at most 1 visible Modal, saw ${n}: ${open.join(', ')}`,
        );
    }
}
