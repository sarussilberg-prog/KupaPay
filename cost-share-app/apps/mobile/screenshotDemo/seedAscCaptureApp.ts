import type { MyProStatus } from '../services/proEntitlements.service';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../hooks/queries/keys';
import { useAppStore } from '../store';
import { CAPTURE_USER_ID } from './ascCaptureSeed';
import { ascCaptureExpenses, ascCaptureExchangeRates } from './ascCaptureFixtures';
import {
    activeBarcelonaGroupName,
    activeCaptureGroups,
    activeCaptureSimplifiedInputs,
    setAscCaptureActiveLanguage,
} from './ascCaptureActiveLocale';
import { captureDisplayNameForUser } from './ascCaptureLocaleData';

export function seedAscCaptureApp(localeAppLanguage: string): void {
    setAscCaptureActiveLanguage(localeAppLanguage);
    const groups = activeCaptureGroups();
    const simplified = activeCaptureSimplifiedInputs();

    queryClient.setQueryData(queryKeys.groups, groups);
    queryClient.setQueryData(queryKeys.simplifiedDebts, simplified);
    queryClient.setQueryData(queryKeys.groupUnreadCounts, {});
    queryClient.setQueryData(queryKeys.activityUnreadCount, 0);
    queryClient.setQueryData(queryKeys.activityFeed(), []);
    queryClient.setQueryData(queryKeys.friends, []);
    queryClient.setQueryData(queryKeys.friendRequestsIncoming, []);
    queryClient.setQueryData(queryKeys.friendRequestsOutgoing, []);

    for (const group of groups) {
        queryClient.setQueryData(queryKeys.groupExpenses(group.id), ascCaptureExpenses(group.id));
    }

    const fx = ascCaptureExchangeRates('ILS', ['EUR', 'USD']);
    queryClient.setQueryData(queryKeys.exchangeRates('ILS', 'EUR,USD'), fx);

    const proCaptureStatus: MyProStatus = {
        hasPro: true,
        individualProUntil: '2027-01-15T00:00:00.000Z',
        groupPassUntil: null,
        includedTripPassCredits: 0,
        unassignedTripPassCount: 0,
        adminProViewMode: 'real',
        adminProViewExpiresAt: null,
    };
    queryClient.setQueryData(queryKeys.proStatus(), proCaptureStatus);
    queryClient.setQueryData(queryKeys.proStatus('g-barcelona'), {
        ...proCaptureStatus,
        hasPro: true,
    });

    queryClient.setQueryData(queryKeys.mySubscription(), {
        lifecycle: 'active',
        planKind: 'yearly',
        priceString: '₪69.90',
        renewalOrExpiryIso: '2027-01-15T00:00:00.000Z',
        autoRenew: true,
        store: 'app_store',
        storeProductId: 'kupapay_pro_yearly',
        storePlanId: null,
        isFreeTrial: false,
        tripPasses: [
            {
                groupId: 'g-barcelona',
                groupName: activeBarcelonaGroupName(),
                expiresAt: '2026-12-20T00:00:00.000Z',
            },
        ],
        serverIndividualUntil: '2027-01-15T00:00:00.000Z',
    });

    const youLabel = captureDisplayNameForUser(localeAppLanguage, CAPTURE_USER_ID);
    useAppStore.setState({
        session: { user: { id: CAPTURE_USER_ID } } as never,
        currentUser: {
            id: CAPTURE_USER_ID,
            displayName: youLabel,
            email: 'capture@kupapay.local',
            inviteToken: 'capture123456',
            defaultCurrency: 'ILS',
            language: localeAppLanguage as never,
            isActive: true,
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as never,
    });
}
