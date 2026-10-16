import type { GroupWithMembers, SimplifiedInputsPayload } from '@cost-share/shared';

export const CAPTURE_USER_ID = 'capture-user-u1';

export const captureGroups: GroupWithMembers[] = [
    {
        id: 'g-barcelona',
        name: 'Barcelona Trip',
        description: 'Summer 2026',
        groupType: 'trip',
        defaultCurrency: 'EUR',
        inviteToken: 'barcelona1',
        createdBy: CAPTURE_USER_ID,
        isActive: true,
        createdAt: new Date('2026-06-01'),
        updatedAt: new Date('2026-10-01'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [
            { userId: CAPTURE_USER_ID, displayName: 'You', isActive: true },
            { userId: 'u-dana', displayName: 'Dana', isActive: true },
            { userId: 'u-yoni', displayName: 'Yoni', isActive: true },
            { userId: 'u-alex', displayName: 'Alex', isActive: true },
        ],
    },
    {
        id: 'g-roommates',
        name: 'Roommates',
        description: 'Home',
        groupType: 'home',
        defaultCurrency: 'ILS',
        inviteToken: 'roommates',
        createdBy: CAPTURE_USER_ID,
        isActive: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2026-10-10'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [
            { userId: CAPTURE_USER_ID, displayName: 'You', isActive: true },
            { userId: 'u-maya', displayName: 'Maya', isActive: true },
            { userId: 'u-idan', displayName: 'Idan', isActive: true },
        ],
    },
    {
        id: 'g-shabbat',
        name: 'Shabbat Dinner',
        description: '',
        groupType: 'event',
        defaultCurrency: 'ILS',
        inviteToken: 'shabbatd',
        createdBy: CAPTURE_USER_ID,
        isActive: true,
        createdAt: new Date('2026-09-20'),
        updatedAt: new Date('2026-09-21'),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: [
            { userId: CAPTURE_USER_ID, displayName: 'You', isActive: true },
            { userId: 'u-noa', displayName: 'Noa', isActive: true },
            { userId: 'u-gal', displayName: 'Gal', isActive: true },
        ],
    },
];

export const captureSimplifiedInputs: SimplifiedInputsPayload = {
    groups: [
        {
            groupId: 'g-barcelona',
            members: [
                { userId: CAPTURE_USER_ID, name: 'You', avatarUrl: null },
                { userId: 'u-dana', name: 'Dana', avatarUrl: null },
                { userId: 'u-yoni', name: 'Yoni', avatarUrl: null },
                { userId: 'u-alex', name: 'Alex', avatarUrl: null },
            ],
            currencies: [
                {
                    currency: 'EUR',
                    nets: [
                        { userId: CAPTURE_USER_ID, net: 85.5 },
                        { userId: 'u-dana', net: -40 },
                        { userId: 'u-yoni', net: -25.5 },
                        { userId: 'u-alex', net: -20 },
                    ],
                },
                {
                    currency: 'ILS',
                    nets: [
                        { userId: CAPTURE_USER_ID, net: 120 },
                        { userId: 'u-dana', net: -120 },
                        { userId: 'u-yoni', net: 0 },
                        { userId: 'u-alex', net: 0 },
                    ],
                },
            ],
        },
        {
            groupId: 'g-roommates',
            members: [
                { userId: CAPTURE_USER_ID, name: 'You', avatarUrl: null },
                { userId: 'u-maya', name: 'Maya', avatarUrl: null },
                { userId: 'u-idan', name: 'Idan', avatarUrl: null },
            ],
            currencies: [
                {
                    currency: 'ILS',
                    nets: [
                        { userId: CAPTURE_USER_ID, net: -85 },
                        { userId: 'u-maya', net: 42.5 },
                        { userId: 'u-idan', net: 42.5 },
                    ],
                },
            ],
        },
    ],
};
