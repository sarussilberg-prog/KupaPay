import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import { APP_VERSION, type AppBuildInfoInput } from '@cost-share/shared';

export function useAppBuildInfoSources(): AppBuildInfoInput {
    return useMemo(() => {
        const buildNumber =
            Application.nativeBuildVersion ??
            Constants.expoConfig?.ios?.buildNumber ??
            Constants.expoConfig?.android?.versionCode?.toString() ??
            null;

        const extra = Constants.expoConfig?.extra as { gitCommitSha?: string } | undefined;
        const commitSha =
            extra?.gitCommitSha?.trim() ||
            process.env.EXPO_PUBLIC_GIT_COMMIT_SHA?.trim() ||
            null;

        const environment =
            process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ??
            process.env.EXPO_PUBLIC_KUPAPAY_ENV ??
            'development';

        return {
            version: APP_VERSION,
            buildNumber,
            commitSha,
            environment,
        };
    }, []);
}
