import { renderHook, act } from '@testing-library/react-native';
import { useBootWatchdog } from '../../hooks/useBootWatchdog';

describe('useBootWatchdog', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('fires onTimeout when boot has not finished within the deadline', () => {
        const onTimeout = jest.fn();
        renderHook(() => useBootWatchdog(false, onTimeout, 12_000));

        expect(onTimeout).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(12_000);
        });
        expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('never fires once boot is already ready', () => {
        const onTimeout = jest.fn();
        renderHook(() => useBootWatchdog(true, onTimeout, 12_000));

        act(() => {
            jest.advanceTimersByTime(60_000);
        });
        expect(onTimeout).not.toHaveBeenCalled();
    });

    it('cancels the watchdog when boot becomes ready before the deadline', () => {
        const onTimeout = jest.fn();
        const { rerender } = renderHook(
            ({ ready }) => useBootWatchdog(ready, onTimeout, 12_000),
            { initialProps: { ready: false } },
        );

        act(() => {
            jest.advanceTimersByTime(5_000);
        });
        rerender({ ready: true });
        act(() => {
            jest.advanceTimersByTime(60_000);
        });
        expect(onTimeout).not.toHaveBeenCalled();
    });
});
