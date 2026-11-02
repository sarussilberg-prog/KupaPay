import { InteractionManager, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { deferClearAppIconBadge, setBadgeCount } from '../../lib/pushNotifications';

const mockGetPermissionsAsync = Notifications.getPermissionsAsync as jest.Mock;
const mockSetBadgeCountAsync = Notifications.setBadgeCountAsync as jest.Mock;

describe('pushNotifications badge guard (#698)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'ios';
        jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task) => {
            if (typeof task === 'function') {
                task();
            }
            return {
                cancel: jest.fn(),
                done: jest.fn(),
                then: (onFulfilled?: () => void, onRejected?: () => void) =>
                    Promise.resolve().then(onFulfilled, onRejected),
            };
        });
        mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockSetBadgeCountAsync.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('skips setBadgeCountAsync when notification permission is not granted', async () => {
        mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });

        await setBadgeCount(0);

        expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
    });

    it('swallows setBadgeCountAsync rejection without throwing', async () => {
        mockSetBadgeCountAsync.mockRejectedValue(new Error('native module failed'));

        await expect(setBadgeCount(3)).resolves.toBeUndefined();
    });

    it('deferClearAppIconBadge clears badge only when permitted', async () => {
        deferClearAppIconBadge();

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(mockSetBadgeCountAsync).toHaveBeenCalledWith(0);
    });

    it('deferClearAppIconBadge skips native call when permission is missing', async () => {
        mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });

        deferClearAppIconBadge();

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(mockSetBadgeCountAsync).not.toHaveBeenCalled();
    });
});
