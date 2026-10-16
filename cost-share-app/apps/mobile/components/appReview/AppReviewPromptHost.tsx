import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { useAppStore } from '../../store';
import { AppReviewPrePromptSheet } from './AppReviewPrePromptSheet';
import { markAppReviewPromptConsumed } from '../../lib/storeReviewPrompt';
import { captureProductEvent } from '../../lib/productAnalytics';
import { rootNavigationRef } from '../../lib/rootNavigationRef';

function navigateToContactUs(): void {
    if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('ContactUs' as never);
        return;
    }
    useAppStore.getState().setPendingNavigation({ target: 'contactUs' });
}

export function AppReviewPromptHost() {
    const pending = useAppStore((s) => s.pendingAppReview);
    const setPending = useAppStore((s) => s.setPendingAppReview);

    const clear = useCallback(() => setPending(null), [setPending]);

    const onDismiss = useCallback(() => {
        if (pending) {
            void captureProductEvent('review_pre_prompt_dismissed', { trigger: pending.trigger });
        }
        clear();
    }, [clear, pending]);

    const onHappy = useCallback(async () => {
        if (!pending) return;
        const { trigger } = pending;
        void captureProductEvent('review_pre_prompt_happy', { trigger });

        if (Platform.OS === 'web') {
            void captureProductEvent('review_web_feedback_shown', { trigger });
            await markAppReviewPromptConsumed();
            clear();
            navigateToContactUs();
            return;
        }

        if (await StoreReview.isAvailableAsync()) {
            await StoreReview.requestReview();
            void captureProductEvent('review_prompt_shown', { trigger });
        }
        await markAppReviewPromptConsumed();
        clear();
    }, [clear, pending]);

    const onUnhappy = useCallback(async () => {
        if (!pending) return;
        const { trigger } = pending;
        void captureProductEvent('review_pre_prompt_unhappy', { trigger });
        await markAppReviewPromptConsumed();
        clear();
        navigateToContactUs();
    }, [clear, pending]);

    React.useEffect(() => {
        if (!pending) return;
        void captureProductEvent('review_pre_prompt_shown', { trigger: pending.trigger });
    }, [pending]);

    const mode = Platform.OS === 'web' ? 'web' : 'native';

    return (
        <AppReviewPrePromptSheet
            visible={pending != null}
            mode={mode}
            onClose={onDismiss}
            onHappy={() => void onHappy()}
            onUnhappy={() => void onUnhappy()}
        />
    );
}
