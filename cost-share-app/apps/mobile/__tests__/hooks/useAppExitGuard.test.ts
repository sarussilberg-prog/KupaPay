import { act, renderHook } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import { useAppExitGuard } from '../../hooks/useAppExitGuard';
import { rootNavigationRef } from '../../lib/rootNavigationRef';

const originalPlatform = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

type ListenerMap = Map<string, Set<EventListener>>;

function installWindowEventStubs(listeners: ListenerMap) {
    const addEventListener = jest.fn((type: string, listener: EventListener) => {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
    });
    const removeEventListener = jest.fn((type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
    });
    Object.defineProperty(globalThis, 'addEventListener', {
        configurable: true,
        writable: true,
        value: addEventListener,
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
        configurable: true,
        writable: true,
        value: removeEventListener,
    });
    return { addEventListener, removeEventListener };
}

describe('useAppExitGuard', () => {
    afterEach(() => {
        setPlatform(originalPlatform);
        jest.restoreAllMocks();
    });

    describe('android', () => {
        let backHandler: (() => boolean) | null = null;

        beforeEach(() => {
            setPlatform('android');
            backHandler = null;
            jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
                backHandler = handler;
                return { remove: jest.fn() };
            });
            jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
            jest.spyOn(rootNavigationRef, 'isReady').mockReturnValue(true);
        });

        it('calls goBack when the navigation stack can pop', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(true);
            const goBack = jest.spyOn(rootNavigationRef, 'goBack').mockImplementation(() => undefined);

            const { result } = renderHook(() => useAppExitGuard());
            expect(backHandler).not.toBeNull();

            let handled = false;
            act(() => {
                handled = backHandler!();
            });

            expect(handled).toBe(true);
            expect(goBack).toHaveBeenCalledTimes(1);
            expect(result.current.exitConfirmVisible).toBe(false);
        });

        it('shows the exit confirm modal when nothing is left to pop', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(false);
            const goBack = jest.spyOn(rootNavigationRef, 'goBack').mockImplementation(() => undefined);

            const { result } = renderHook(() => useAppExitGuard());

            let handled = false;
            act(() => {
                handled = backHandler!();
            });

            expect(handled).toBe(true);
            expect(goBack).not.toHaveBeenCalled();
            expect(result.current.exitConfirmVisible).toBe(true);
        });

        it('exits the app when confirmExit is called', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(false);
            const { result } = renderHook(() => useAppExitGuard());

            act(() => {
                backHandler!();
            });
            act(() => {
                result.current.confirmExit();
            });

            expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
            expect(result.current.exitConfirmVisible).toBe(false);
        });
    });

    describe('web', () => {
        const listeners: ListenerMap = new Map();

        beforeEach(() => {
            setPlatform('web');
            listeners.clear();
            installWindowEventStubs(listeners);

            Object.defineProperty(globalThis, 'location', {
                configurable: true,
                value: { href: 'https://app.kupapay.test/' },
            });
            Object.defineProperty(globalThis, 'history', {
                configurable: true,
                value: {
                    pushState: jest.fn(),
                    go: jest.fn(),
                },
            });
            jest.spyOn(rootNavigationRef, 'isReady').mockReturnValue(true);
        });

        afterEach(() => {
            // @ts-expect-error test cleanup
            delete globalThis.location;
            // @ts-expect-error test cleanup
            delete globalThis.history;
        });

        function dispatchPopState() {
            const set = listeners.get('popstate');
            expect(set?.size).toBeGreaterThan(0);
            act(() => {
                set!.forEach(listener => listener(new Event('popstate')));
            });
        }

        it('pushes a spare history entry on mount and pops in-app on popstate', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(true);
            const goBack = jest.spyOn(rootNavigationRef, 'goBack').mockImplementation(() => undefined);

            const { result } = renderHook(() => useAppExitGuard());

            expect(globalThis.history.pushState).toHaveBeenCalled();
            dispatchPopState();

            expect(goBack).toHaveBeenCalledTimes(1);
            expect(result.current.exitConfirmVisible).toBe(false);
            // Neutralize re-push after the user Back press.
            expect(globalThis.history.pushState).toHaveBeenCalledTimes(2);
        });

        it('shows the exit confirm modal when nothing is left to pop', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(false);
            const goBack = jest.spyOn(rootNavigationRef, 'goBack').mockImplementation(() => undefined);

            const { result } = renderHook(() => useAppExitGuard());
            dispatchPopState();

            expect(goBack).not.toHaveBeenCalled();
            expect(result.current.exitConfirmVisible).toBe(true);
        });

        it('calls history.go(-2) on confirmExit and ignores the next popstate', () => {
            jest.spyOn(rootNavigationRef, 'canGoBack').mockReturnValue(false);
            const { result } = renderHook(() => useAppExitGuard());

            dispatchPopState();
            act(() => {
                result.current.confirmExit();
            });

            expect(globalThis.history.go).toHaveBeenCalledWith(-2);
            expect(result.current.exitConfirmVisible).toBe(false);

            const pushCallsBefore = (globalThis.history.pushState as jest.Mock).mock.calls.length;
            dispatchPopState();
            // Allowed popstate should not re-push / reopen the modal.
            expect((globalThis.history.pushState as jest.Mock).mock.calls.length).toBe(pushCallsBefore);
            expect(result.current.exitConfirmVisible).toBe(false);
        });
    });

    describe('ios', () => {
        it('registers neither BackHandler nor popstate listeners', () => {
            setPlatform('ios');
            const listeners: ListenerMap = new Map();
            const { addEventListener } = installWindowEventStubs(listeners);
            const addBack = jest.spyOn(BackHandler, 'addEventListener');

            renderHook(() => useAppExitGuard());

            expect(addBack).not.toHaveBeenCalled();
            expect(addEventListener).not.toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });
});
