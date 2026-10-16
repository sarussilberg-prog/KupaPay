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

export function buildGroupCardPreviewRollups(): Record<string, GroupRollup> {
    return {
        'g-trip': rollupOf({ currency: 'ILS', net: -761.5 }, [{ currency: 'AFN', net: 138.75 }]),
        'g-multi': rollupOf({ currency: 'EUR', net: 42.5 }, [{ currency: 'USD', net: 30 }]),
        'g-settled': rollupOf({ currency: 'USD', net: 0 }),
    };
}

export function buildGroupCardPreviewGroups(): GroupWithMembers[] {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 86_400_000);
    const specs: PreviewGroupSpec[] = [
        {
            id: 'g-trip',
            name: 'דירת שותפים',
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
