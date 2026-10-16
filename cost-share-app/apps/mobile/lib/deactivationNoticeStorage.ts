import { Platform } from 'react-native';
import { authStorage } from './authStorage';

const DEACTIVATION_NOTICE_KEY = '@kupapay/pending_deactivation_notice';

type NoticeStorage = {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};

/** Web: sessionStorage so a cold visit to login does not resurrect stale localStorage flags. */
const webNoticeStorage: NoticeStorage = {
    getItem: (key) => Promise.resolve(globalThis.sessionStorage?.getItem(key) ?? null),
    setItem: (key, value) => {
        globalThis.sessionStorage?.setItem(key, value);
        return Promise.resolve();
    },
    removeItem: (key) => {
        globalThis.sessionStorage?.removeItem(key);
        return Promise.resolve();
    },
};

function noticeStorage(): NoticeStorage {
    return Platform.OS === 'web' ? webNoticeStorage : authStorage;
}

/** Persist across web OAuth full-page reloads (zustand alone is lost). */
export async function markDeactivationNoticePending(): Promise<void> {
    await noticeStorage().setItem(DEACTIVATION_NOTICE_KEY, '1');
}

export async function consumeDeactivationNoticePending(): Promise<boolean> {
    const value = await noticeStorage().getItem(DEACTIVATION_NOTICE_KEY);
    if (value !== '1') return false;
    await noticeStorage().removeItem(DEACTIVATION_NOTICE_KEY);
    return true;
}

export async function clearDeactivationNoticePending(): Promise<void> {
    await noticeStorage().removeItem(DEACTIVATION_NOTICE_KEY);
}
