import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { shareTextMessage } from './platformShare';

export async function shareGroupSummaryFromRef(
    ref: RefObject<View | null>,
    fallbackMessage: string,
): Promise<void> {
    if (!ref.current) {
        await shareTextMessage(fallbackMessage);
        return;
    }

    if (Platform.OS === 'web') {
        await shareTextMessage(fallbackMessage);
        return;
    }

    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
        await shareTextMessage(fallbackMessage);
        return;
    }
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: fallbackMessage });
}
