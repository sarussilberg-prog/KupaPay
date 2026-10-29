import React from 'react';
import * as Sentry from '@sentry/react-native';
import { ScreenErrorFallback } from './ScreenErrorFallback';
import { SENTRY_TAGS } from '../lib/sentryTags';

type Props = {
    screenName: string;
    children: React.ReactNode;
};

type State = {
    error: Error | null;
};

export class ScreenErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        Sentry.captureException(error, {
            tags: { tag: SENTRY_TAGS.SCREEN_ERROR, screen: this.props.screenName },
            extra: { componentStack: info.componentStack },
        });
    }

    private reset = (): void => {
        this.setState({ error: null });
    };

    render(): React.ReactNode {
        if (this.state.error) {
            return (
                <ScreenErrorFallback onRetry={this.reset} screenName={this.props.screenName} />
            );
        }
        return this.props.children;
    }
}
