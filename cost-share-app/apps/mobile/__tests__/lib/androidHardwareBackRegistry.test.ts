import {
    dispatchAndroidHardwareBack,
    pushAndroidHardwareBackHandler,
    resetAndroidHardwareBackRegistryForTests,
} from '../../lib/androidHardwareBackRegistry';

describe('androidHardwareBackRegistry', () => {
    afterEach(() => {
        resetAndroidHardwareBackRegistryForTests();
    });

    it('invokes the most recently registered handler first', () => {
        const order: number[] = [];
        pushAndroidHardwareBackHandler(() => {
            order.push(1);
            return true;
        });
        pushAndroidHardwareBackHandler(() => {
            order.push(2);
            return true;
        });

        expect(dispatchAndroidHardwareBack()).toBe(true);
        expect(order).toEqual([2]);
    });

    it('falls through when the top handler returns false', () => {
        const second = jest.fn(() => true);
        pushAndroidHardwareBackHandler(() => false);
        pushAndroidHardwareBackHandler(second);

        expect(dispatchAndroidHardwareBack()).toBe(true);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('returns false when no handler consumes the event', () => {
        pushAndroidHardwareBackHandler(() => false);
        expect(dispatchAndroidHardwareBack()).toBe(false);
    });

    it('removes handlers when the unsubscribe function runs', () => {
        const handler = jest.fn(() => true);
        const unsubscribe = pushAndroidHardwareBackHandler(handler);
        unsubscribe();
        expect(dispatchAndroidHardwareBack()).toBe(false);
    });
});
