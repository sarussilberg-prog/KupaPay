import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
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

function WebPostHogClientBinder({ children }: { children: React.ReactNode }) {
    const webClient = useMemo(() => {
        if (!isPostHogConfigured()) return null;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const posthog = require('posthog-js').default as typeof import('posthog-js').default;
        const apiKey = getPostHogApiKey()!;
        const host = getPostHogHost();
        if (!posthog.__loaded) {
            posthog.init(apiKey, {
                api_host: host,
                autocapture: false,
                capture_pageview: false,
                disable_session_recording: true,
                persistence: 'localStorage',
            });
        }
        return posthog;
    }, []);

    useEffect(() => {
        if (!webClient) {
            setProductAnalyticsClient(null);
            return;
        }
        setProductAnalyticsClient({
            capture: (event, properties) => webClient.capture(event, properties),
            identify: (distinctId, properties) => webClient.identify(distinctId, properties),
            reset: () => webClient.reset(),
        });
        return () => setProductAnalyticsClient(null);
    }, [webClient]);

    return <>{children}</>;
}

export function PostHogAnalyticsProvider({ children }: { children: React.ReactNode }) {
    if (!isPostHogConfigured()) {
        return <>{children}</>;
    }

    if (Platform.OS === 'web') {
        return <WebPostHogClientBinder>{children}</WebPostHogClientBinder>;
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
