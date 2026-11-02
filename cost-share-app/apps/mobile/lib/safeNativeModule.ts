import { InteractionManager } from 'react-native';

/**
 * Runs a non-critical native-module call after current interactions finish,
 * on the JS thread, with errors swallowed so TurboModule NSExceptions cannot
 * take down the screen (RN new-arch void-method class — see KNOWN_ISSUES KI-037).
 */
export function deferNonCriticalNativeTask(task: () => void | Promise<void>): void {
    InteractionManager.runAfterInteractions(() => {
        void Promise.resolve()
            .then(() => task())
            .catch(() => {
                /* native module rejected or threw — non-fatal */
            });
    });
}
