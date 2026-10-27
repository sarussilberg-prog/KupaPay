import type { GroupRollup, GroupWithMembers } from '@cost-share/shared';
import { rollupOf } from '../testUtils/groupRollup';

type PreviewGroupSpec = {
    id: string;
    name: string;
    groupType: GroupWithMembers['groupType'];
    defaultCurrency: string;
    memberNames: string[];
    lastActivityAt: Date;
};

function makePreviewGroup(spec: PreviewGroupSpec, createdAt: Date): GroupWithMembers {
    return {
        id: spec.id,
        name: spec.name,
        groupType: spec.groupType,
        defaultCurrency: spec.defaultCurrency,
        inviteToken: `preview-${spec.id}`,
        createdBy: 'u1',
        isActive: true,
        createdAt,
        updatedAt: spec.lastActivityAt,
        lastActivityAt: spec.lastActivityAt,
        members: spec.memberNames.map((displayName, index) => ({
            userId: `u${index + 1}`,
            displayName,
            isActive: true,
        })),
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
    };
}

/** Two-card hero (owe + owed) without extra-currency lines — screenshot / design QA. */
export function buildGroupCardHeroPreviewRollups(): Record<string, GroupRollup> {
    return {
        'g-trip': rollupOf({ currency: 'ILS', net: -761.5 }),
        'g-multi': rollupOf({ currency: 'EUR', net: 42.5 }),
    };
}

export function buildGroupCardPreviewRollups(options?: { stress?: boolean }): Record<string, GroupRollup> {
    if (options?.stress) {
        return {
            'g-trip': rollupOf({ currency: 'ILS', net: -12_345.67 }, [
                { currency: 'AFN', net: 138.75 },
                { currency: 'EUR', net: 90.25 },
            ]),
            'g-multi': rollupOf({ currency: 'EUR', net: 42_500.5 }, [{ currency: 'USD', net: 30 }]),
            'g-settled': rollupOf({ currency: 'USD', net: 0 }),
        };
    }
    return {
        'g-trip': rollupOf({ currency: 'ILS', net: -761.5 }, [{ currency: 'AFN', net: 138.75 }]),
        'g-multi': rollupOf({ currency: 'EUR', net: 42.5 }, [{ currency: 'USD', net: 30 }]),
        'g-settled': rollupOf({ currency: 'USD', net: 0 }),
    };
}

const STRESS_GROUP_NAME =
    'Very long shared household name for layout stress testing across locales';

export function buildGroupCardPreviewGroups(options?: { stress?: boolean }): GroupWithMembers[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 86_400_000);
    const specs: PreviewGroupSpec[] = [
        {
            id: 'g-trip',
            name: options?.stress ? STRESS_GROUP_NAME : 'דירת שותפים',
            groupType: 'home',
            defaultCurrency: 'ILS',
            memberNames: ['Noa', 'Yoni', 'Maya'],
            lastActivityAt: now,
        },
        {
            id: 'g-multi',
            name: 'Summer trip',
            groupType: 'trip',
            defaultCurrency: 'EUR',
            memberNames: ['Alex', 'Sam'],
            lastActivityAt: weekAgo,
        },
        {
            id: 'g-settled',
            name: 'Office lunch',
            groupType: 'work',
            defaultCurrency: 'USD',
            memberNames: ['Pat'],
            lastActivityAt: weekAgo,
        },
    ];
    return specs.map(spec => makePreviewGroup(spec, weekAgo));
}
