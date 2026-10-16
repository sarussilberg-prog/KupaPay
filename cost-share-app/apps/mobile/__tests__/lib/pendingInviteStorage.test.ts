import {
    clearPersistedPendingInvite,
    loadPersistedPendingInvite,
    persistPendingInvite,
} from '../../lib/pendingInviteStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const SecureStore = jest.requireMock('expo-secure-store') as {
    setItemAsync: jest.Mock;
    getItemAsync: jest.Mock;
    deleteItemAsync: jest.Mock;
};

describe('pendingInviteStorage (native SecureStore)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        SecureStore.deleteItemAsync.mockResolvedValue(undefined);
    });

    it('persists valid group invite JSON', async () => {
        await persistPendingInvite({ kind: 'group', token: 'AbCdEfGhIjKl' });
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
            'kupapay.pending_invite.v1',
            JSON.stringify({ kind: 'group', token: 'AbCdEfGhIjKl' }),
        );
    });

    it('rejects invalid token on load', async () => {
        SecureStore.getItemAsync.mockResolvedValue(
            JSON.stringify({ kind: 'group', token: 'short' }),
        );
        await expect(loadPersistedPendingInvite()).resolves.toBeNull();
    });

    it('clears storage', async () => {
        await clearPersistedPendingInvite();
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('kupapay.pending_invite.v1');
    });

    it('migrates legacy AsyncStorage invite into SecureStore', async () => {
        const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage') as {
            getItem: jest.Mock;
            removeItem: jest.Mock;
        };
        SecureStore.getItemAsync.mockResolvedValue(null);
        AsyncStorage.getItem.mockResolvedValue(
            JSON.stringify({ kind: 'friend', token: 'AbCdEfGhIjKl' }),
        );
        await expect(loadPersistedPendingInvite()).resolves.toEqual({
            kind: 'friend',
            token: 'AbCdEfGhIjKl',
        });
        expect(SecureStore.setItemAsync).toHaveBeenCalled();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kupapay/pending_invite_v1');
    });
});
