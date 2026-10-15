import React, { useEffect } from 'react';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { getPostHogApiKey, getPostHogHost, isPostHogConfigured } from '../lib/posthogEnv';
import { setProductAnalyticsClient } from '../lib/productAnalytics';

function PostHogClientBinder({ children }: { children: React.ReactNode }) {
    const posthog = usePostHog();

    useEffect(() => {
        if (!posthog) {
            setProductAnalyticsClient(null);
            return;
        }
        setProductAnalyticsClient({
            capture: (event, properties) => posthog.capture(event, properties as never),
            identify: (distinctId, properties) => posthog.identify(distinctId, properties as never),
            reset: () => posthog.reset(),
        });
        return () => setProductAnalyticsClient(null);
    }, [posthog]);

    return <>{children}</>;
}

export function PostHogAnalyticsProvider({ children }: { children: React.ReactNode }) {
    if (!isPostHogConfigured()) {
        return <>{children}</>;
    }

    const apiKey = getPostHogApiKey()!;
    const host = getPostHogHost();

    return (
        <PostHogProvider
            apiKey={apiKey}
            autocapture={false}
            options={{
                host,
                enableSessionReplay: false,
                captureAppLifecycleEvents: false,
            }}
        >
            <PostHogClientBinder>{children}</PostHogClientBinder>
        </PostHogProvider>
    );
}
