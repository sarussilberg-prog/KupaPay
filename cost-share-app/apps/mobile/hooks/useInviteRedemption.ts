/**
 * useInviteRedemption — listens for incoming invite URLs and dispatches
 * the redemption flow. If the user is not yet signed in, the link is
 * parked in the Zustand store as `pendingInvite` and replayed after
 * sign-in. Auth-callback URLs are ignored here.
 */

import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import {
    parseIncomingUrl,
    handleInviteLink,
} from '../services/deepLinks.service';
import { isAuthCallbackUrl } from '../services/auth.service';
import { persistPendingInvite, clearPersistedPendingInvite } from '../lib/pendingInviteStorage';
import { shouldClearPendingInviteAfterRedemption } from '../lib/inviteRedemptionClear';

export function useInviteRedemption(): void {
    const incomingUrl = Linking.useURL();
    const navigation = useNavigation() as any;
    const queryClient = useQueryClient();
    const session = useAppStore(s => s.session);
    const pendingInvite = useAppStore(s => s.pendingInvite);
    const setPendingInvite = useAppStore(s => s.setPendingInvite);

    // Handle new incoming URLs
    useEffect(() => {
        if (!incomingUrl) return;
        if (isAuthCallbackUrl(incomingUrl)) return; // handled elsewhere
        const link = parseIncomingUrl(incomingUrl);
        if (link.kind === 'unknown') return;

        if (link.kind === 'settleReminder') {
            if (session) {
                void handleInviteLink(link, navigation, queryClient);
            } else {
                const pending = { kind: link.kind, token: link.token };
                setPendingInvite(pending);
                void persistPendingInvite(pending);
            }
            return;
        }

        if (!session) {
            const pending = { kind: link.kind, token: link.token };
            setPendingInvite(pending);
            void persistPendingInvite(pending);
            return;
        }
        void handleInviteLink(link, navigation, queryClient);
    }, [incomingUrl, session, navigation, queryClient, setPendingInvite]);

    // Replay pending invite once signed in (AppNavigator mounted — navigation available)
    useEffect(() => {
        if (!session || !pendingInvite) return;
        void handleInviteLink(pendingInvite, navigation, queryClient).then(result => {
            if (shouldClearPendingInviteAfterRedemption(result)) {
                setPendingInvite(null);
                void clearPersistedPendingInvite();
            }
        });
        // Intentionally only re-run when session flips on or pendingInvite changes.
    }, [session, pendingInvite, navigation, queryClient, setPendingInvite]);
}
