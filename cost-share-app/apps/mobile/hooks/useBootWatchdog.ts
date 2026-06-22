import { useEffect } from 'react';

/**
 * Last-resort boot deadline. App boot is already bounded — every await in
 * App.tsx's init() has its own timeout — so this only fires if a future change
 * (or an unforeseen native/SDK stall) leaves init() hung. It's set well above
 * the longest legitimate boot path so it never trips during normal slow boots;
 * its sole job is to guarantee the native splash can never strand the user.
 *
 * Sized above the longest legitimate boot: hydrateAuthSession's hard deadline
 * (~3.5s) plus acceptSession's assertProfileActiveWithTimeout (~8s) on a hung
 * (connected-but-dead) network ≈ 11.5s, so 15s leaves margin to avoid tripping
 * during a genuinely slow boot and briefly flashing the login screen.
 */
export const BOOT_WATCHDOG_MS = 15_000;

/**
 * Forces the app past the splash if boot hasn't completed within `timeoutMs`.
 * No-ops once `ready` is true (and cancels itself the moment boot finishes).
 *
 * `onTimeout` must be stable (wrap in useCallback) — an unstable identity
 * re-arms the timer on every render and would prevent it from ever firing.
 */
export function useBootWatchdog(
    ready: boolean,
    onTimeout: () => void,
    timeoutMs: number = BOOT_WATCHDOG_MS,
): void {
    useEffect(() => {
        if (ready) return;
        const id = setTimeout(onTimeout, timeoutMs);
        return () => clearTimeout(id);
    }, [ready, onTimeout, timeoutMs]);
}
