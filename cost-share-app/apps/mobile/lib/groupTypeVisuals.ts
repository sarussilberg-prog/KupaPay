import type { GroupType } from '@cost-share/shared';

export type GroupTypeIcon =
    | 'airplane-outline'
    | 'home-outline'
    | 'heart-outline'
    | 'people-outline'
    | 'briefcase-outline'
    | 'calendar-outline'
    | 'people-circle-outline'
    | 'apps-outline';

export interface GroupTypeVisual {
    icon: GroupTypeIcon;
    gradient: [string, string];
    emoji: string;
}

export const GROUP_TYPE_VISUALS: Record<GroupType, GroupTypeVisual> = {
    trip: { icon: 'airplane-outline', gradient: ['#60A5FA', '#3B82F6'], emoji: '✈️' },
    home: { icon: 'home-outline', gradient: ['#34D399', '#10B981'], emoji: '🏠' },
    couple: { icon: 'heart-outline', gradient: ['#F472B6', '#EC4899'], emoji: '💑' },
    general: { icon: 'people-outline', gradient: ['#A78BFA', '#7C3AED'], emoji: '👥' },
    work: { icon: 'briefcase-outline', gradient: ['#FBBF24', '#D97706'], emoji: '💼' },
    event: { icon: 'calendar-outline', gradient: ['#FB7185', '#E11D48'], emoji: '🎉' },
    friends: { icon: 'people-circle-outline', gradient: ['#38BDF8', '#0284C7'], emoji: '🤝' },
    other: { icon: 'apps-outline', gradient: ['#94A3B8', '#475569'], emoji: '📦' },
};

export function groupInitialsFromName(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function getGroupTypeVisual(type: GroupType): GroupTypeVisual {
    return GROUP_TYPE_VISUALS[type] ?? GROUP_TYPE_VISUALS.general;
}
