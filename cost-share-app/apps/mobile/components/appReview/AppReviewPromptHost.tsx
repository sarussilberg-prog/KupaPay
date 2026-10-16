import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { useAppStore } from '../../store';
import { AppReviewWebFeedbackSheet } from './AppReviewWebFeedbackSheet';
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

function WebAppReviewPromptHost() {
    const pending = useAppStore((s) => s.pendingAppReview);
    const setPending = useAppStore((s) => s.setPendingAppReview);

    const clear = useCallback(() => setPending(null), [setPending]);

    const onDismiss = useCallback(() => {
        if (pending) {
            void captureProductEvent('review_web_feedback_dismissed', { trigger: pending.trigger });
        }
        clear();
    }, [clear, pending]);

    const onShareFeedback = useCallback(async () => {
        if (!pending) return;
        const { trigger } = pending;
        void captureProductEvent('review_web_feedback_cta', { trigger });
        await markAppReviewPromptConsumed();
        clear();
        navigateToContactUs();
    }, [clear, pending]);

    React.useEffect(() => {
        if (!pending) return;
        void captureProductEvent('review_web_feedback_shown', { trigger: pending.trigger });
    }, [pending]);

    return (
        <AppReviewWebFeedbackSheet
            visible={pending != null}
            onClose={onDismiss}
            onShareFeedback={() => void onShareFeedback()}
        />
    );
}

/** Web-only host for post–positive-moment feedback prompt. Native uses in-app review directly. */
export function AppReviewPromptHost() {
    if (Platform.OS !== 'web') return null;
    return <WebAppReviewPromptHost />;
}
