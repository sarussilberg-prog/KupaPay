/**
 * Share plain text across platforms. On web uses the Web Share API when available,
 * otherwise copies to the clipboard.
 */

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showSuccessMessage } from './appToast';

export async function shareTextMessage(message: string): Promise<void> {
    if (Platform.OS !== 'web') {
        await Share.share({ message });
        return;
    }

    const nav = globalThis.navigator;
    if (nav?.share) {
        try {
            await nav.share({ text: message });
            return;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return;
            }
        }
    }

    await Clipboard.setStringAsync(message);
    showSuccessMessage('common.linkCopied');
}
