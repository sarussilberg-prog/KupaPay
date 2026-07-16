import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onlineManager } from '@tanstack/react-query';
import type { GroupWithMembers } from '@cost-share/shared';
import { AppNavigator } from '../navigation/AppNavigator';
import { navigationIntegration } from '../lib/sentry';
import { rootNavigationRef } from '../lib/rootNavigationRef';
import { OnboardingCreateGroupScreen } from '../screens/onboarding/OnboardingCreateGroupScreen';
import {
    hasCompletedPostLoginOnboarding,
    markPostLoginOnboardingComplete,
} from '../lib/onboardingStorage';
import { runAuthenticatedGate } from '../lib/authenticatedGateResolve';
import { useAuthenticatedInviteRedemption } from '../hooks/useAuthenticatedInviteRedemption';
import { fetchGroups } from '../services/groups.service';
import { useAvatarPrefetcher } from '../hooks/useAvatarPrefetcher';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import { AppGateSkeleton } from './skeletons/AppGateSkeleton';

/**
 * Hard ceiling on how long resolveGate will wait for fetchGroups before
 * giving up and falling through to the main app. Supabase calls can hang
 * indefinitely on flaky / offline connections, and a hung gate means the
 * user stares at the skeleton forever.
 */
const GATE_FETCH_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('gate fetch timeout')), ms);
        promise.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (err) => {
                clearTimeout(t);
                reject(err);
            },
        );
    });
}

type GateState = 'loading' | 'create' | 'main';

export function AuthenticatedAppGate() {
    const [gate, setGate] = useState<GateState>('loading');

    const enterMainAfterGroupInvite = useCallback(async () => {
        await markPostLoginOnboardingComplete();
        setGate('main');
    }, []);

    useAuthenticatedInviteRedemption({ onGroupRedeemed: () => void enterMainAfterGroupInvite() });

    // Cache every avatar URL the app knows about into the OS image cache so
    // member/friend/group avatars render instantly and work offline. Single
    // mount, debounced, deduped — runs for the whole authenticated session.
    useAvatarPrefetcher();

    const resolveGate = useCallback(async () => {
        // Seeds the groups cache before mounting the navigator so GroupsListScreen
        // never renders the full-screen boot splash inside the tabs (which would
        // leave the bottom bar visible behind the loading icon). The online fetch
        // is bounded by GATE_FETCH_TIMEOUT_MS so a hung Supabase call can't strand
        // the user on the skeleton; on timeout we still resolve the gate.
        const target = await runAuthenticatedGate<GroupWithMembers>({
            hasCompletedPostLoginOnboarding,
            markPostLoginOnboardingComplete,
            getCachedGroupsCount: () =>
                (queryClient.getQueryData<GroupWithMembers[]>(queryKeys.groups) ?? []).length,
            isOnline: () => onlineManager.isOnline(),
            fetchGroups: () => withTimeout(fetchGroups(), GATE_FETCH_TIMEOUT_MS),
            seedGroups: (groups) => queryClient.setQueryData(queryKeys.groups, groups),
        });
        setGate(target);
    }, []);

    useEffect(() => {
        void resolveGate();
    }, [resolveGate]);

    if (gate === 'loading') {
        return <AppGateSkeleton />;
    }

    if (gate === 'create') {
        return <OnboardingCreateGroupScreen onDone={() => setGate('main')} />;
    }

    return (
        <NavigationContainer
            ref={rootNavigationRef}
            onReady={() => navigationIntegration.registerNavigationContainer(rootNavigationRef)}
        >
            <AppNavigator />
        </NavigationContainer>
    );
}
