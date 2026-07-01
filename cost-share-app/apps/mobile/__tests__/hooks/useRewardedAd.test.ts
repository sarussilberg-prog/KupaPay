import { renderHook, act } from '@testing-library/react-native';

// Capture the event listeners the hook registers so the test can fire ad
// lifecycle events on demand.
const mockListeners: Record<string, Array<() => void>> = {};
const mockAd = {
    addAdEventListener: jest.fn((type: string, cb: () => void) => {
        (mockListeners[type] ||= []).push(cb);
        return () => {
            mockListeners[type] = (mockListeners[type] ?? []).filter(f => f !== cb);
        };
    }),
    load: jest.fn(),
    show: jest.fn().mockResolvedValue(undefined),
};

jest.mock('react-native-google-mobile-ads', () => ({
    RewardedAd: { createForAdRequest: jest.fn(() => mockAd) },
    RewardedAdEventType: {
        LOADED: 'rewarded_loaded',
        EARNED_REWARD: 'rewarded_earned_reward',
    },
    AdEventType: { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed' },
    TestIds: { REWARDED: 'test-rewarded' },
}));

jest.mock('../../services/monetization.service', () => ({
    logMonetizationEvent: jest.fn(),
}));

import { useRewardedAd } from '../../hooks/useRewardedAd';

function fire(type: string) {
    act(() => {
        (mockListeners[type] ?? []).forEach(cb => cb());
    });
}

describe('useRewardedAd', () => {
    beforeEach(() => {
        for (const k of Object.keys(mockListeners)) delete mockListeners[k];
        jest.clearAllMocks();
    });

    it('clears loading once the ad reports LOADED', () => {
        const { result } = renderHook(() => useRewardedAd('remind_user'));
        expect(result.current.loading).toBe(true);
        fire('rewarded_loaded');
        expect(result.current.loading).toBe(false);
    });

    it('signals earned as soon as EARNED_REWARD fires — while the ad is still open', () => {
        const { result } = renderHook(() => useRewardedAd('remind_user'));
        fire('rewarded_loaded');
        expect(result.current.earned).toBe(false);

        // The reward is granted while the full-screen ad still covers the screen.
        // The single-modal remind flow advances its content here so that when the
        // ad dismisses, the next step is already shown (no flash of the gate).
        fire('rewarded_earned_reward');
        expect(result.current.earned).toBe(true);
    });

    it('does NOT signal earned if the ad closes without earning a reward', () => {
        const { result } = renderHook(() => useRewardedAd('remind_user'));
        fire('rewarded_loaded');
        fire('closed');
        expect(result.current.earned).toBe(false);
    });

    it('clears loading if the ad fails to load (ERROR) so the gate is not stuck', () => {
        const { result } = renderHook(() => useRewardedAd('remind_user'));
        expect(result.current.loading).toBe(true);
        fire('error');
        expect(result.current.loading).toBe(false);
    });
});
