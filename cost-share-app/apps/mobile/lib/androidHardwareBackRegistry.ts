/**
 * LIFO stack of Android hardware-back handlers for overlays that must close
 * before React Navigation pops (or before the app exit guard runs).
 */
type AndroidHardwareBackHandler = () => boolean;

const handlerStack: AndroidHardwareBackHandler[] = [];

export function pushAndroidHardwareBackHandler(handler: AndroidHardwareBackHandler): () => void {
    handlerStack.push(handler);
    return () => {
        const index = handlerStack.lastIndexOf(handler);
        if (index >= 0) {
            handlerStack.splice(index, 1);
        }
    };
}

/** Returns true when a registered overlay consumed the back press. */
export function dispatchAndroidHardwareBack(): boolean {
    for (let i = handlerStack.length - 1; i >= 0; i -= 1) {
        if (handlerStack[i]()) {
            return true;
        }
    }
    return false;
}

/** @internal test helper */
export function resetAndroidHardwareBackRegistryForTests(): void {
    handlerStack.length = 0;
}
