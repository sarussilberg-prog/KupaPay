import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useSystemNotificationsDenied } from '../../hooks/useSystemNotificationsDenied';
import { getPermissionStatus } from '../../lib/pushNotifications';

jest.mock('../../lib/pushNotifications', () => ({
    getPermissionStatus: jest.fn(),
}));

const mockGetPermissionStatus = getPermissionStatus as jest.MockedFunction<typeof getPermissionStatus>;

describe('useSystemNotificationsDenied', () => {
    let appStateHandler: (s: string) => void;

    beforeEach(() => {
        mockGetPermissionStatus.mockReset();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
            appStateHandler = handler as (s: string) => void;
            return { remove: jest.fn() } as any;
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it('returns false when permission is granted', async () => {
        mockGetPermissionStatus.mockResolvedValue('granted' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('returns true when permission is denied', async () => {
        mockGetPermissionStatus.mockResolvedValue('denied' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(true));
    });

    it('returns false when permission is undetermined', async () => {
        mockGetPermissionStatus.mockResolvedValue('undetermined' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(false));
    });

    it('re-checks when the app returns to foreground', async () => {
        mockGetPermissionStatus.mockResolvedValue('denied' as any);
        const { result } = renderHook(() => useSystemNotificationsDenied());
        await waitFor(() => expect(result.current).toBe(true));

        mockGetPermissionStatus.mockResolvedValue('granted' as any);
        await act(async () => { appStateHandler('active'); });
        await waitFor(() => expect(result.current).toBe(false));
    });
});
