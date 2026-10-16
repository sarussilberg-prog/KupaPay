import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';
import { formatDeferredInviteClipboard } from '@cost-share/shared';
import { recoverDeferredInviteAttribution } from '../../lib/recoverDeferredInviteAttribution';
import {
    hasCheckedDeferredInviteAttribution,
    markDeferredInviteAttributionChecked,
} from '../../lib/deferredAttributionStorage';
import { loadPersistedPendingInvite } from '../../lib/pendingInviteStorage';

jest.mock('expo-application', () => ({
    getInstallReferrerAsync: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
    getStringAsync: jest.fn(),
}));

jest.mock('../../lib/deferredAttributionStorage', () => ({
    hasCheckedDeferredInviteAttribution: jest.fn(),
    markDeferredInviteAttributionChecked: jest.fn(),
}));

jest.mock('../../lib/pendingInviteStorage', () => ({
    persistPendingInvite: jest.fn(),
    loadPersistedPendingInvite: jest.fn(),
}));

const TOKEN = 'AbCdEfGhIjKl';

describe('recoverDeferredInviteAttribution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (hasCheckedDeferredInviteAttribution as jest.Mock).mockResolvedValue(false);
        (markDeferredInviteAttributionChecked as jest.Mock).mockResolvedValue(undefined);
    });

    it('reads Android Play Install Referrer on first launch', async () => {
        Platform.OS = 'android';
        (Application.getInstallReferrerAsync as jest.Mock).mockResolvedValue(
            'invite_kind=group&invite_token=' + TOKEN,
        );

        const invite = await recoverDeferredInviteAttribution(false);

        expect(invite).toEqual({ kind: 'group', token: TOKEN });
        expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
        expect(markDeferredInviteAttributionChecked).toHaveBeenCalled();
    });

    it('falls back to clipboard on iOS when referrer is unavailable', async () => {
        Platform.OS = 'ios';
        (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
            formatDeferredInviteClipboard({ kind: 'friend', token: TOKEN }),
        );

        const invite = await recoverDeferredInviteAttribution(false);

        expect(invite).toEqual({ kind: 'friend', token: TOKEN });
    });

    it('skips when attribution was already checked', async () => {
        (hasCheckedDeferredInviteAttribution as jest.Mock).mockResolvedValue(true);
        const invite = await recoverDeferredInviteAttribution(false);
        expect(invite).toBeNull();
        expect(Application.getInstallReferrerAsync).not.toHaveBeenCalled();
    });

    it('marks checked but does not read when invite already pending', async () => {
        await recoverDeferredInviteAttribution(true);
        expect(markDeferredInviteAttributionChecked).toHaveBeenCalled();
        expect(Application.getInstallReferrerAsync).not.toHaveBeenCalled();
    });
});

describe('persisted invite integration', () => {
    it('loadPersistedPendingInvite remains compatible with deferred recovery', async () => {
        (loadPersistedPendingInvite as jest.Mock).mockResolvedValue({
            kind: 'group',
            token: TOKEN,
        });
        const loaded = await loadPersistedPendingInvite();
        expect(loaded?.kind).toBe('group');
    });
});
